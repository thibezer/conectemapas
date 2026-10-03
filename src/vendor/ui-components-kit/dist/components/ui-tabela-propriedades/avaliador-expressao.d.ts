/**
 * Avaliador de expressões matemáticas para campos numéricos técnicos (AutoCAD / Revit / Blender).
 * Parser seguro de descida recursiva sem eval(), com suporte a +, -, *, /, ^, parênteses,
 * porcentagens, constantes (pi, e) e funções matemáticas (sqrt, abs, round, floor, ceil, sin, cos, tan).
 */
export declare function avaliarExpressaoMatematica(expr: string): number | null;
