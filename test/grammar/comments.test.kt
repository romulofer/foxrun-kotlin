// SYNTAX TEST "source.kotlin" "comments"
// line comment
// <-- punctuation.definition.comment.kotlin
/* outer /* nested */ still comment */ val a = 1
// <-- comment.block.kotlin
//                    ^^^^^^^^^^^^^^^^ comment.block.kotlin
//                                     ^^^ storage.type.variable.kotlin
/**
 * Adds numbers.
// ^^^^^^^^^^^^ comment.block.documentation.kotlin
 * @param a first value
// ^^^^^^ keyword.other.documentation.kdoc.kotlin
//        ^ variable.parameter.kdoc.kotlin
 */
fun add(a: Int) = a
// <--- storage.type.function.kotlin
val url = "http://example.com" // trailing
//         ^^^^^^^^^^^^^^^^^^ string.quoted.double.kotlin
//                             ^^^^^^^^^^^ comment.line.double-slash.kotlin
