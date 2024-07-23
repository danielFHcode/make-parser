export type Result<T> =
    | {
          success: true;
          value: T;
          endIndex: number;
      }
    | {
          success: false;
          messages: string[];
          failIndex: number;
          unReversible?: boolean;
      };

export type InferParserType<TParser extends Parser<unknown>> =
    TParser extends Parser<infer T> ? T : unknown;

export class Parser<T> {
    constructor(
        public readonly parse: (
            code: string,
            startIndex: number
        ) => Result<T>
    ) {}

    map<K>(
        map: (value: T, startIndex: number, endIndex: number) => K
    ) {
        return new Parser<K>((code, startIndex) => {
            const result = this.parse(code, startIndex);
            if (!result.success) {
                return result;
            }
            return {
                ...result,
                value: map(result.value, startIndex, result.endIndex),
            };
        });
    }

    mapFailMessage(map: (message: string[]) => string[]) {
        return new Parser<T>((code, startIndex) => {
            const result = this.parse(code, startIndex);
            if (result.success) {
                return result;
            }
            return {
                ...result,
                messages: map(result.messages),
            };
        });
    }

    concat<K>(parser: Parser<K>) {
        return new Parser<[T, K]>((code, startIndex) => {
            const firstResult = this.parse(code, startIndex);
            if (!firstResult.success) {
                return firstResult;
            }
            const secondResult = parser.parse(
                code,
                firstResult.endIndex
            );
            if (!secondResult.success) {
                return secondResult;
            }
            return {
                success: true,
                value: [firstResult.value, secondResult.value],
                endIndex: secondResult.endIndex,
            };
        });
    }

    join<K>(parser: Parser<K>) {
        return this.concat(parser).map((value) => value[0]);
    }

    joinRight<K>(parser: Parser<K>) {
        return this.concat(parser).map((value) => value[1]);
    }

    unReversible() {
        return new Parser((code, startIndex) => {
            const result = this.parse(code, startIndex);
            if (!result.success) {
                return {
                    ...result,
                    unReversible: true,
                };
            }
            return result;
        });
    }

    union<K>(parser: Parser<K>) {
        return new Parser<T | K>((code, startIndex) => {
            const ownResult = this.parse(code, startIndex);
            if (ownResult.success) {
                return ownResult;
            }
            if (ownResult.unReversible) {
                return ownResult;
            }
            const othersResult = parser.parse(code, startIndex);
            if (othersResult.success) {
                return othersResult;
            }
            if (othersResult.unReversible) {
                return othersResult;
            }
            return {
                success: false,
                failIndex: startIndex,
                messages: ownResult.messages.concat(
                    othersResult.messages
                ),
            };
        });
    }

    repeat(minimumIterations: number = 0) {
        return new Parser<T[]>((code, startIndex) => {
            const values = new Array<T>();
            let endIndex = startIndex;
            while (
                endIndex < code.length ||
                values.length < minimumIterations
            ) {
                const result = this.parse(code, endIndex);
                if (!result.success) {
                    if (
                        result.unReversible ||
                        values.length < minimumIterations
                    ) {
                        return result;
                    } else {
                        break;
                    }
                }
                values.push(result.value);
                endIndex = result.endIndex;
            }
            return {
                success: true,
                value: values,
                endIndex,
            };
        });
    }

    wrap() {
        return new Parser<string>((code, startIndex) => {
            const result = this.parse(code, startIndex);
            if (!result.success) {
                return result;
            }
            return {
                ...result,
                value: code.substring(startIndex, result.endIndex),
            };
        });
    }

    option() {
        return this.union(Parser.NONE);
    }

    static dynamic = <T>(getParser: () => Parser<T>) => {
        return new Parser((code, startIndex) => {
            return getParser().parse(code, startIndex);
        });
    };
    static match(
        filter: (character: string) => boolean,
        getMessage: (character: string) => string = (character) => {
            return `Unexpected Character: '${character}'`;
        }
    ) {
        return new Parser((code, startIndex) => {
            const character = code[startIndex] ?? '';
            if (filter(character)) {
                return {
                    success: true,
                    value: character,
                    endIndex: startIndex + 1,
                };
            } else {
                return {
                    success: false,
                    messages: [getMessage(character)],
                    failIndex: startIndex,
                };
            }
        });
    }
    static NONE = new Parser<null>((code, startIndex) => {
        return {
            success: true,
            value: null,
            endIndex: startIndex,
        };
    });
}

export const word = (word: string) => {
    let parser = Parser.match(
        (char) => char === word[0],
        (char) => {
            return `Unexpected character: expected '${word}', instead found '${char}'`;
        }
    );
    for (const character of word.substring(1)) {
        parser = parser
            .concat(
                Parser.match(
                    (char) => char === character,
                    (char) => {
                        return `Unexpected character: expected '${word}' (specifically '${character}'), instead found '${char}'`;
                    }
                )
            )
            .wrap();
    }
    return parser;
};
