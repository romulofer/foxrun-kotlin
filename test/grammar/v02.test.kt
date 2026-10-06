// SYNTAX TEST "source.kotlin" "v0.2 grammar and highlighting"
val s = $$"cost $5 $$name $${x + 1}"
//      ^^^ punctuation.definition.string.begin.kotlin
//              ^^ string.quoted.double.kotlin - meta.template.expression.kotlin
//                 ^^^^^^ meta.template.expression.kotlin
//                   ^^^^ variable.other.template.kotlin
//                        ^^^ punctuation.definition.template-expression.begin.kotlin
//                           ^^^^^ meta.embedded.line.kotlin
//                                ^ punctuation.definition.template-expression.end.kotlin
val t = $$"""raw $$x"""
//      ^^^^^ string.quoted.triple.kotlin punctuation.definition.string.begin.kotlin
//                 ^ variable.other.template.kotlin
val m = "${map["k"]} ok"
//             ^^^ string.quoted.double.kotlin
//                 ^ punctuation.definition.template-expression.end.kotlin
//                  ^^^ string.quoted.double.kotlin
value class Id(val raw: Long)
// <----- storage.modifier.kotlin
//    ^^^^^ storage.type.class.kotlin
//          ^^ entity.name.type.class.kotlin
fun interface Runner {
// <--- storage.modifier.kotlin
//  ^^^^^^^^^ storage.type.class.kotlin
//            ^^^^^^ entity.name.type.class.kotlin
data object Empty
// <---- storage.modifier.kotlin
//   ^^^^^^ storage.type.class.kotlin
//          ^^^^^ entity.name.type.class.kotlin
enum class Color { RED, GREEN, BLUE }
// <---- storage.modifier.kotlin
//         ^^^^^ entity.name.type.class.kotlin
//                 ^^^ variable.other.constant.kotlin
sealed interface Shape
// <------ storage.modifier.kotlin
//     ^^^^^^^^^ storage.type.class.kotlin
//               ^^^^^ entity.name.type.class.kotlin
expect fun platform(): String
// <------ storage.modifier.kotlin
//     ^^^ storage.type.function.kotlin
//         ^^^^^^^^ entity.name.function.kotlin
class Box<T : Comparable<T>>
//    ^^^ entity.name.type.class.kotlin
//        ^ entity.name.type.parameter.kotlin
//            ^^^^^^^^^^ entity.name.type.kotlin
context(logger: Logger) fun run() {}
// <------- storage.modifier.kotlin
//                      ^^^ storage.type.function.kotlin
//                          ^^^ entity.name.function.kotlin
val a = make(name = "x", count = 3)
//      ^^^^ entity.name.function.call.kotlin
//           ^^^^ variable.parameter.named.kotlin
//                       ^^^^^ variable.parameter.named.kotlin
list.map { x -> x }
//         ^ variable.parameter.lambda.kotlin
list.filter { it > 1 }
//            ^^ variable.language.it.kotlin
val n = user.name.length
//           ^^^^ variable.other.property.kotlin
//                ^^^^^^ variable.other.property.kotlin
val c = Color.RED
//      ^^^^^ entity.name.type.kotlin
//            ^^^ variable.other.constant.kotlin
/** See [Foo.bar] and @param x */
//      ^^^^^^^^^ markup.underline.link.kdoc.kotlin
//                    ^^^^^^ keyword.other.documentation.kdoc.kotlin
val x: List<*>? = null
//          ^ keyword.operator.star-projection.kotlin
//            ^ punctuation.definition.nullable.kotlin
val l = emptyList<String>()
//      ^^^^^^^^^ entity.name.function.call.kotlin
//                ^^^^^^ entity.name.type.kotlin
@get:JvmName("n") val v = 1
// <------------ storage.type.annotation.kotlin
val r = when (v) { is Int if v > 3 -> 1 else -> 0 }
//                        ^^ keyword.control.kotlin
//                                 ^^ keyword.operator.arrow.kotlin
val sum = a + b * 2 - c
//              ^ keyword.operator.arithmetic.kotlin
