# Make Parser

A flexible tool for making parsers in javascript/typescript simply and easily.

## Installation

```bash
npm install make-parser
```

Node:

```js
// esm
import * as MakeParser from 'make-parser';

// commonjs
const MakeParser = require('make-parser');
```

Browser:

```html
<!-- esm -->
<script type="module">
    import * as MakeParser from 'node_modules/make-parser/dist/index.js';
</script>

<!-- non-esm (umd) -->
<script src="node_modules/make-parser/dist/index.cjs"></script>
<script>
    MakeParser;
</script>
```

## Usage

You mainly use the `Parser` class, it takes in a parse method and the lets you use parsing combinator on it:

```js
import { Parser } from 'make-parser';

// custom parser
const digitParser = new Parser((code, startIndex) => {
    const char = code[startIndex];
    if ('1234567890'.includes(char)) {
        return {
            success: true,
            value: char,
            endIndex: startIndex + 1,
        };
    } else {
        return {
            success: false,
            message: `${char} is not a digit`,
            failIndex: startIndex,
        };
    }
});

console.log(digitParser('1', 0));
// { success: true, value: '1', endIndex: 1 }

// `concatenation` parsing combinator
const twoDigitParser = digitParser.contact(digitParser);

console.log(twoDigitParser('12', 0));
// { success: true, value: ['1','2'], endIndex: 1 }
```

Though, in practice, you probably won't write custom parsers, because there are some build in parsers available. In this case we can use the built in `word` parser:

```js
import { Parser, word } from 'make-parser';

// word parser in combination with the `union` parsing combinator
// does more or less the same thing as the previous `digitParser`
const digitParser = word('0')
    .union(word('1'))
    .union(word('2'))
    .union(word('3'))
    .union(word('4'))
    .union(word('5'))
    .union(word('6'))
    .union(word('7'))
    .union(word('8'))
    .union(word('9'));

console.log(digitParser.parse('1', 0));
// { success: true, value: '1', endIndex: 1 }

// concatenation parsing combinator
const twoDigitParser = digitParser.contact(digitParser);

console.log(twoDigitParser.parse('12', 0));
// { success: true, value: ['1','2'], endIndex: 1 }
```

## Examples

### Simple Number Parser

```js
import { Parser, word } from 'make-parser';

// parses characters which are one of 0,1,2,3,4,5,6,7,8,9
const digit = word('0')
    .union(word('1'))
    .union(word('2'))
    .union(word('3'))
    .union(word('4'))
    .union(word('5'))
    .union(word('6'))
    .union(word('7'))
    .union(word('8'))
    .union(word('9'));
const number = digit
    .repeat() // an array of digits
    .concat(word('.')) // followed by a dot
    .concat(
        digit.repeat(1).unReversible()
    ) /* followed by an array of digits with
         at least one digit, that is
         un-reversible (see the `un-reversible`
         section bellow). */
    .union(
        // or
        digit.repeat(1) // an array of digits with at least one digit
    )
    .wrap() // return a string instead of an array of individual digits and dots
    .map((value) => parseFloat(value)); // return a number, not a string of a number

console.log(number.parse('12.5', 0));
// { success: true, value: 12.5, endIndex: 4 }
console.log(number.parse('1.x', 0));
// {
//   success: false,
//   messages: [
//          "Unexpected character: expected '0', instead found 'x'",
//          "Unexpected character: expected '1', instead found 'x'",
//          "Unexpected character: expected '2', instead found 'x'",
//          "Unexpected character: expected '3', instead found 'x'",
//          "Unexpected character: expected '4', instead found 'x'",
//          "Unexpected character: expected '5', instead found 'x'",
//          "Unexpected character: expected '6', instead found 'x'",
//          "Unexpected character: expected '7', instead found 'x'",
//          "Unexpected character: expected '8', instead found 'x'",
//          "Unexpected character: expected '9', instead found 'x'"
//      ],
//   failIndex: 2
// }
```

### Addition Parser

```ts
import { Parser, word } from 'make-parser';
import type { InferParserType } from 'make-parser';

// alternative way of matching a digit
const digit = Parser.match(
    // match given character
    (char) => char.match(/[0-9]/) !== null,
    // generate error when match fails
    (char) => `Unexpected character: expected digit, found '${char}'`
);

// similar to previous example
const number = digit
    .repeat(1)
    .union(
        digit
            .repeat()
            .concat(word('.'))
            .concat(digit.repeat(1).unReversible())
    )
    .wrap()
    .map((value) => ({
        // map to custom AST
        type: 'Number' as const, // for typescript
        value: parseFloat(value),
    }));

// You don't have to supply a custom error message when using match
const whitespace = Parser.match(
    (char) => char.match(/\s/) !== null
).repeat();

const add =
    // whitespace followed by a number, but only including the number's parse result
    whitespace
        .joinRight(number)
        // Note: x.concat(y).union(z) is not the same as x.concat(y.union(z))!
        .concat(
            whitespace
                .concat(word('+'))
                .concat(whitespace)
                .joinRight(number)
                .repeat()
        )
        .join(whitespace)
        .map((numbers) => ({
            type: 'Add' as const,
            numbers,
        }));

export const program = add;

// types are inferred properly
export type Number = InferParserType<typeof number>;
export type Add = InferParserType<typeof add>;
```

### Full Arithmetic Parser

```ts
import { Parser, word } from 'make-parser';
import type { InferParserType } from 'make-parser';

const whitespace = Parser.match(
    (char) => char.match(/\s/) !== null
).repeat();

// alternative way of matching a digit
const digit = Parser.match(
    (char) => char.match(/[0-9]/) !== null,
    (char) => `Unexpected character: expected digit, found '${char}'`
);

const number = digit
    .repeat(1)
    .union(
        digit
            .repeat()
            .concat(word('.'))
            .concat(digit.repeat(1).unReversible())
    )
    .wrap()
    .map((value, start, end) => ({
        type: 'Number' as const,
        start,
        end,
        value: parseFloat(value),
    }));
export type Number = InferParserType<typeof number>;

export type Expression =
    | {
          type: 'Add' | 'Subtract' | 'Multiply' | 'Divide';
          start: number;
          end: number;
          left: Expression;
          right: Expression;
      }
    | Number;

// Explicit types are often required for recursive parsers
const unit: Parser<Expression> = word('(')
    .concat(whitespace)
    // we need to use Parser.dynamic because `add` has yet to be defined.
    .joinRight(Parser.dynamic(() => addSub))
    .join(whitespace.concat(word(')')))
    .union(number);

// I feal like these are actually pretty self explanatory,
// though you might have an easier time understanding them
// if you opened the code up in an editor where you could
// hover over everything to see the inferred types.
const mulDiv = unit
    .concat(
        whitespace
            .joinRight(word('*').union(word('/')))
            .join(whitespace)
            .concat(unit)
            .repeat()
    )
    .map(([base, mulDivs]) => {
        return mulDivs.reduce((left, [operator, right]) => {
            return {
                type:
                    operator === '*'
                        ? ('Multiply' as const)
                        : ('Divide' as const),
                start: left.start,
                end: right.end,
                left,
                right,
            };
        }, base);
    });
const addSub = unit
    .concat(
        whitespace
            .joinRight(word('+').union(word('-')))
            .join(whitespace)
            .concat(unit)
            .repeat()
    )
    .map(([base, addSubs]) => {
        return addSubs.reduce((left, [operator, right]) => {
            return {
                type:
                    operator === '+'
                        ? ('Add' as const)
                        : ('Subtract' as const),
                start: left.start,
                end: right.end,
                left,
                right,
            };
        }, base);
    });

export const program = whitespace
    .joinRight(addSub)
    .option()
    .concat(
        whitespace
            .concat(word(';'))
            .concat(whitespace)
            .joinRight(addSub.option()) // make addSub not required, so you can do things like `1+2;;3`.
            .repeat()
    )
    .join(whitespace)
    .map(([first, tail]) => ({
        type: 'Program' as const,
        expressions: [first, ...tail].filter(
            (expression) => expression !== null
        ),
    }));
export type Program = InferParserType<typeof program>;
```

### JSON Parser

```ts
import { Parser, word } from 'make-parser';

const whitespace = Parser.match(
    (char) => char.match(/\s/) !== null
).repeat();

const digit = Parser.match(
    (char) => char.match(/[0-9]/) !== null,
    (char) => `Unexpected character: expected digit, found '${char}'`
);
const number = digit
    .repeat(1)
    .union(
        digit
            .repeat()
            .concat(word('.'))
            .concat(digit.repeat(1).unReversible())
    )
    .wrap()
    .map((value) => parseFloat(value));

const string = word('"')
    .joinRight(
        Parser.match((char) => char !== '"' && char !== '\n')
            .union(word('\\"'))
            .repeat()
            // notice the wrap is inside `joinRight` as to not include the quotes
            .wrap()
    )
    .join(word('"'))
    .map((string) => string.replaceAll('\\"', ''));

const boolean = word('true')
    .union(word('true'))
    .map((word) => word === 'true');

const array = word('[')
    .concat(whitespace)
    .joinRight(
        Parser.dynamic(() => JSON)
            .concat(
                whitespace
                    .concat(word(','))
                    .concat(whitespace)
                    .joinRight(Parser.dynamic(() => JSON))
                    .repeat()
            )
            .map(([first, other]) => [first, ...other])
            .option() // JSON doesn't support trailing commas
            .map((array) => array ?? [])
    )
    .join(whitespace)
    .join(word(']'));

const object = word('{')
    .concat(whitespace)
    .joinRight(
        string
            .join(whitespace)
            .join(word(':'))
            .join(whitespace)
            .concat(Parser.dynamic(() => JSON))
            .concat(
                whitespace
                    .concat(word(','))
                    .concat(whitespace)
                    .joinRight(string)
                    .join(word(':'))
                    .join(whitespace)
                    .concat(Parser.dynamic(() => JSON))
                    .repeat()
            )
            .map(([first, others]) =>
                Object.fromEntries([first, ...others])
            )
            .option()
            .map((value) => value ?? {})
    );

export type JSON =
    | number
    | string
    | boolean
    | JSON[]
    | { [key: string]: JSON };

export const JSON: Parser<JSON> = whitespace
    .joinRight(
        number.union(string).union(boolean).union(array).union(object)
    )
    .join(whitespace);
```

## Important Concepts

### EndIndex

Whenever you run a parser on your code (and it succeeds), it returns 2 things:

-   `value` - The value that was parsed (AKA the AST)
-   `endIndex` - The index at which it finished parsing

Now, it is important to understand that when you run your finished parser, `endIndex` is not guarantied to be the last index in your code.

For example, take this parser:

```js
import { word } from 'make-parser';

export const parser = word('.');
```

When we run it on a valid input we get a successful output:

```js
console.log(parser.parse('.', 0));
// { success: true, value: '.', endIndex: 1 }
```

And when we run it on an invalid input we get a failed output:

```js
console.log(parser.parse(':', 0));
// { success: false, message: [...], failIndex: 0 }
```

But not always:

```js
console.log(parser.parse('..', 0));
// { success: true, value: '.', endIndex: 1 }
```

`".."` is not equal to `"."`, and so it should fail when being parsed by `word(".")`, right? Actually, no.

Look at this parser:

```js
const parserTimes2 = parser.concat(parser);
```

The way `x.concat(y)` works (conceptually), is that, given some piece of code `code` and a starting index `startIndex`, it will first run `x.parse(code,startIndex)`, and then, if that didn't fail, it will run `y.parse(code, x.parse(code,startIndex).endIndex)`.

So, if `parser.parse('..',0)` fails, then `parserTimes2.parse('..',0)` will also fail, because it's success is reliant on `parser`'s success. Get it?

So, essentially, when you're parsing some piece of code using `Parser.prototype.parse`, getting a successful result only means the start of the string has been parsed successfully, and not it's entirety.

This means that after receiving a parse result, if you wan't to make sure that it parsed your entire code, you must do so manually through post parse checks, or in-parser features like [un-reversible](#unreversible).

### UnReversible

_Note:_ this feature was almost directly stolen from the scala library [fastparse](https://com-lihaoyi.github.io/fastparse/). So, um, thanks to them.

Lets look at this simple parser:

```js
import { Parser, word } from 'make-parser';

const oneParser = word('1.0').union(word('1')).repeat();
```

If we run it with a proper, it seams to be working fine:

```js
console.log(oneParser.parse('1', 0));
// { success: true, value: ['1'], endIndex: 1 }

console.log(oneParser.parse('1.01', 0));
// { success: true, value: ['1.0','1'], endIndex: 4 }
```

But now lets try to run it with an incorrect input:

```js
console.log(oneParser.parse('1.1', 0));
// { success: true, value: '1', endIndex: 1 }
```

What's going on? Why has it succeeded? Well, lets look at what the parser is actually doing:

The parser is a union of the parsers `word("1.0")` and `word("1")`, this means that when it is given an input, it will first try running the `word("1.0")` parser and fail - as expected - but, because this is a union, it will also then try and run the `word("1")` parser, and succeed (for reasons explained in the [EndIndex](#endindex) section).

To prevent this, we can mark a point in the parsing process at which we can confidentially say that if our parser fails, then it is necessarily a syntax error and the parser should not go back and try other parts of the union, in other words, it makes errors in that part of the code **un-reversible** - this is what `Parser.prototype.unReversible` is for.

In out case we wan't to force an error once we have seen `1.`, because then the next character must be 0, and so lets update our parser to do that:

```js
import { Parser, word } from 'make-parser';

const oneParser = word('1.')
    .concat(
        // once you reach 0 you must've surpassed `1.`
        word('0').unReversible()
    ) // we have to break `1.0` into 2 parts
    .union(word('1'))
    .repeat();
```

Now let's try again:

```js
console.log(oneParser.parse('1.1', 0));
// { success: false, messages: [...], failIndex: 1 }
```

Woo! It failed!
