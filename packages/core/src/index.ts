/**
 * The result of {@link Parser.parse}.
 * @property unReversible - see {@link Parser.unReversible}
 */
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
    /**
     * @param parse - what is ran when {@link Parser.parse} is called.
     */
    constructor(
        public readonly parse: (
            code: string,
            startIndex: number
        ) => Result<T>
    ) {}

    /**
     * @returns A parser that parses just like the current one, except
     * the `value` property of {@link Result} (when `success` is true) is
     * ran through the `map` parameter.
     * @example
     * const p1 = word('1');
     * p1.parse('1', 0); // { success: true, value: '1', endIndex: 1 }
     * const p2 = p1.map(value => parseInt(value));
     * p2.parse('1', 0); // { success: true, value: 1, endIndex: 1 }
     */
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

    /**
     * @returns A parser that parses just like the current one, except
     * the `messages` property of {@link Result} (when `success` is true) is
     * ran through the `map` parameter.
     * @example
     * const p1 = Parser.match(char => char.match(/\d/));
     * p1.parse('a', 0); // { success: false, messages: ["Unexpected character: 'a'"], failIndex: 0 }
     * const p2 = p1.mapFailMessage(messages => messages.concat('x'));
     * p2.parse('a', 0); // { success: false, messages: ["Unexpected character: 'a'", "x"], failIndex: 0 }
     */
    mapFailMessages(map: (message: string[]) => string[]) {
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

    /**
     * @returns A parser that runs the parse method on this parser, and
     * then of the `parser` parameter - starting where this's parse ended -
     * and returns a result where the value is a tuple of the two previous
     * parsers' results' value (assuming both succeeded).
     * @example
     * const x = word('x');
     * x.parse('x',0); // { success: true, value: 'x', endIndex: 1 }
     * const y = word('y');
     * y.parse('y',0); // { success: true, value: 'y', endIndex: 1 }
     * const xy = x.concat(y);
     * xy.parse('xy',0); // { success: true, value: ['x','y'], endIndex: 2 }
     */
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

    /**
     * Just like concat except the value returned by the parser isn't a
     * tuple, but rather just the value of this's parser's result.
     * @example
     * const x = word('x');
     * x.parse('x',0); // { success: true, value: 'x', endIndex: 1 }
     * const y = word('y');
     * y.parse('x',0); // { success: true, value: 'y', endIndex: 1 }
     * const xy = x.concat(y);
     * xy.parse('xy',0); // { success: true, value: 'x', endIndex: 2 }
     */
    join<K>(parser: Parser<K>) {
        return this.concat(parser).map((value) => value[0]);
    }

    /**
     * Just like concat except the value returned by the parser isn't a
     * tuple, but rather just the value of the `parser` parameter's
     * parser's result.
     * @example
     * const x = word('x');
     * x.parse('x',0); // { success: true, value: 'x', endIndex: 1 }
     * const y = word('y');
     * y.parse('x',0); // { success: true, value: 'y', endIndex: 1 }
     * const xy = x.concat(y);
     * xy.parse('xy',0); // { success: true, value: 'y', endIndex: 2 }
     */
    joinRight<K>(parser: Parser<K>) {
        return this.concat(parser).map((value) => value[1]);
    }

    /**
     * Makes sure that once this parser fails, the entire parse halts.
     * @example
     * const x = word('x');
     * const y = word('y');
     *
     * x.union(y).parse('a');
     * // {
     * //    success: false,
     * //    messages: [
     * //      "Unexpected character: expected 'x', instead found 'a'",
     * //      "Unexpected character: expected 'y', instead found 'a'",
     * //    ],
     * //    failIndex: 0
     * // }
     *
     * x.unReversible().union(y).parse('a');
     * // {
     * //    success: false,
     * //    messages: [
     * //      "Unexpected character: expected 'x', instead found 'a'",
     * //    ],
     * //    failIndex: 0
     * // }
     * @example
     * const x = word('x');
     *
     * x.repeat().parse('a')
     * // {
     * //    success: true,
     * //    value: [],
     * //    endIndex: 0
     * // }
     *
     * x.unReversible().repeat().parse('a')
     * // {
     * //    success: false,
     * //    messages: [
     * //      "Unexpected character: expected 'x', instead found 'a'",
     * //    ],
     * //    failIndex: 0
     * // }
     */
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

    /**
     * @returns A parser that reties to run this's parse method and return
     * it, and if it fails then the `parser` parameter's and return it. If
     * both fail (and non are unReversible), it returns both's error message.
     * @example
     * const x = word('x');
     * x.parse('x',0); // { success: true, value: 'x', endIndex: 1 }
     * const y = word('y');
     * y.parse('y',0); // { success: true, value: 'y', endIndex: 1 }
     * const xy = x.union(y);
     * xy.parse('x',0); // { success: true, value: 'x', endIndex: 1 }
     * xy.parse('y',0); // { success: true, value: 'y', endIndex: 1 }
     */
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

    /**
     * @param minimumIterations - if the length of the list returned by the
     * returned parser is not greater than or equal to this value, it will
     * return a failed result.
     * @returns A parser that parser that parses using this's parse method
     * as many times as possible, until it has either reached the end of
     * code or it failed to parse, at which point it returns an array of
     * all the values from the various results.
     * @example
     * const x = word('x');
     * x.parse('x',0); // { success: true, value: 'x', endIndex: 1 }
     * const xs = x.repeat();
     * xs.parse('xxx',0); // { success: true, value: ['x','x','x'], endIndex: 3 }
     */
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

    /**
     * @returns A parser wich returns the same `endIndex` as the current parser,
     * but returns a `string` value which is a substring of the code between
     * where the parser started parsing and where it ended.
     * @example
     * const xy = word('x').concat(word('y'));
     * xy.parse('xy',0); // { success: true, value: ['x','y'], endIndex: 2 }
     * const xyWrapped = xy.wrap();
     * xyWrapped.parse('xy',0); // { success: true, value: 'xy', endIndex: 2 }
     */
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

    /**
     * @returns A parser that tries to parse using this's parse method and
     * if it fails just returns a result with value null.
     * @example
     * const x = word('x').option();
     * x.parse('x',0); // { success: true, value: 'x', endIndex: 1 }
     * x.parse('y',0); // { success: true, value: null, endIndex: 0 }
     */
    option() {
        return this.union(Parser.NONE);
    }

    /**
     * @returns A parser that calls the `getParser` parameter every time it needs
     * to parse and then run the received parser's parse method to parse.
     * @example
     * const x = Parser.dynamic(() => y);
     * const y = word('y');
     * x.parse('y',0); // { success: true, value: 'y', endIndex: 1 }
     */
    static dynamic = <T>(getParser: () => Parser<T>) => {
        return new Parser((code, startIndex) => {
            return getParser().parse(code, startIndex);
        });
    };
    /**
     * @param getMessage - called to generate the error message when the
     * parser fails.
     * @returns A parser the checks whether or not the given character returns
     * `true` when passed to `filter`, and the returns a result of it if so. When
     * the given character is undefined (AKA when the `startIndex` is out of range),
     * an empty string is passed.
     * @example
     * const x = Parser.match(char => char === 'x');
     * x.parse('x',0) // { success: true, value: 'x', endIndex: 1 }
     * @example
     * const x = Parser.match(
     *      char => char === 'x',
     *      char => `Expected 'x', found '${char}'`
     *  );
     * x.parse('y',0); // { success: false, value: ["Expected 'x', found 'y'"], failIndex: 0 }
     */
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
    /**
     * A parser the always returns a result with a value of null, and the same
     * `endIndex` as the `startIndex` it is given.
     * @example
     * Parser.NONE.parse('whatever',0) // { success: true, value: null, endIndex: 0 }
     */
    static NONE = new Parser<null>((code, startIndex) => {
        return {
            success: true,
            value: null,
            endIndex: startIndex,
        };
    });
}

/**
 * @returns A parser that parses the first `word.length` characters of the given
 * code, starting from the `startIndex, to make sure they are the same as `word`'s
 * characters.
 * @example
 * const xy = word('xy');
 * xy.parse('xy',0); // { success: true, value: 'xy', endIndex: 2 }
 */
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
