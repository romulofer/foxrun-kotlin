// SYNTAX TEST "source.kotlin" "expressions"
val s = "a\n$name ${user.age + 1} \q"
//      ^ punctuation.definition.string.begin.kotlin
//       ^ string.quoted.double.kotlin
//        ^^ constant.character.escape.kotlin
//          ^ punctuation.definition.template-expression.begin.kotlin
//           ^^^^ variable.other.template.kotlin
//                ^^ punctuation.definition.template-expression.begin.kotlin
//                  ^^^^ meta.embedded.line.kotlin
//                             ^ constant.numeric.decimal.kotlin
//                              ^ punctuation.definition.template-expression.end.kotlin
//                                ^^ invalid.illegal.escape.kotlin
val t = "${list.map { it * 2 }}"
//                  ^ punctuation.section.block.begin.kotlin
//                           ^ punctuation.section.block.end.kotlin
//                            ^ punctuation.definition.template-expression.end.kotlin
//                             ^ punctuation.definition.string.end.kotlin
val raw = """line "quoted" $x"""
//        ^^^ string.quoted.triple.kotlin
//                 ^^^^^^ string.quoted.triple.kotlin
//                         ^ punctuation.definition.template-expression.begin.kotlin
//                           ^^^ punctuation.definition.string.end.kotlin
val c = '\u0041'
//      ^ string.quoted.single.kotlin
//       ^^^^^^ constant.character.escape.kotlin
val n = listOf(1_000, 0xFF, 0b1010, 3.14f, 1e10, 42L, 7u, .5)
//      ^^^^^^ entity.name.function.call.kotlin
//             ^^^^^ constant.numeric.decimal.kotlin
//                    ^^^^ constant.numeric.hex.kotlin
//                          ^^^^^^ constant.numeric.binary.kotlin
//                                  ^^^^^ constant.numeric.float.kotlin
//                                         ^^^^ constant.numeric.float.kotlin
//                                               ^^^ constant.numeric.decimal.kotlin
//                                                    ^^ constant.numeric.decimal.kotlin
//                                                        ^^ constant.numeric.float.kotlin
for (i in 1..10) {}
// <--- keyword.control.kotlin
//     ^^ keyword.operator.in.kotlin
//         ^^ keyword.operator.range.kotlin
//           ^^ constant.numeric.decimal.kotlin
val y = x ?: return null
//        ^^ keyword.operator.elvis.kotlin
//           ^^^^^^ keyword.control.kotlin
//                  ^^^^ constant.language.null.kotlin
val z = a?.b!!::class
//       ^^ keyword.operator.safe-call.kotlin
//          ^^ keyword.operator.not-null-assertion.kotlin
//            ^^ keyword.operator.reference.kotlin
if (x !is String && y is Int) {}
//    ^^^ keyword.operator.type.kotlin
//                    ^^ keyword.operator.type.kotlin
//               ^^ keyword.operator.logical.kotlin
loop@ for (i in 0 until 3) { break@loop }
// <----- entity.name.label.kotlin
//                           ^^^^^ keyword.control.kotlin
//                                ^^^^^ entity.name.label.kotlin
val flag = true
//         ^^^^ constant.language.boolean.kotlin
