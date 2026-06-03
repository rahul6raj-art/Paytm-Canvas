import type {
  ArrowFunctionExpression,
  BlockStatement,
  Expression,
  File,
  FunctionExpression,
  JSXAttribute,
  JSXElement,
  JSXExpressionContainer,
  JSXFragment,
  JSXSpreadAttribute,
  JSXSpreadChild,
  JSXText,
  ObjectExpression,
  ObjectProperty,
  PrivateName,
} from "@babel/types";
import type { ReactStyleRecord } from "./reactStyle";

export type ModuleArrayItem = Record<string, string | number | boolean>;

export type ModuleArrays = Map<string, ModuleArrayItem[]>;

/** `const statusColors = { confirmed: { bg: '…' }, … }` */
export type ModuleNestedMaps = Map<string, Record<string, ModuleArrayItem>>;

type JSXChild = JSXElement | JSXFragment | JSXExpressionContainer | JSXText | JSXSpreadChild;

function unwrapExpression(expr: Expression): Expression {
  if (expr.type === "ParenthesizedExpression") return unwrapExpression(expr.expression);
  if (expr.type === "TSAsExpression" || expr.type === "TSSatisfiesExpression") {
    return unwrapExpression(expr.expression);
  }
  return expr;
}

function unwrapOperand(operand: Expression | PrivateName): Expression | null {
  if (operand.type === "PrivateName") return null;
  return unwrapExpression(operand);
}

function literalFromExpression(
  expr: Expression | null | undefined,
  constants?: Map<string, string | number>,
): string | number | boolean | undefined {
  if (!expr) return undefined;
  const e = unwrapExpression(expr);
  if (e.type === "StringLiteral") return e.value;
  if (e.type === "NumericLiteral") return e.value;
  if (e.type === "BooleanLiteral") return e.value;
  if (e.type === "Identifier" && constants?.has(e.name)) return constants.get(e.name);
  return undefined;
}

function evalObjectItem(
  expr: ObjectExpression,
  constants?: Map<string, string | number>,
): ModuleArrayItem {
  const item: ModuleArrayItem = {};
  for (const prop of expr.properties) {
    if (prop.type !== "ObjectProperty") continue;
    const key =
      prop.key.type === "Identifier"
        ? prop.key.name
        : prop.key.type === "StringLiteral"
          ? prop.key.value
          : null;
    if (!key) continue;
    const val = literalFromExpression(prop.value as Expression, constants);
    if (val !== undefined) item[key] = val;
  }
  return item;
}

/** Top-level `const items = [{ id: 'a', … }]` arrays used in `.map()`. */
export function collectModuleArrays(
  ast: File,
  constants?: Map<string, string | number>,
): ModuleArrays {
  const map: ModuleArrays = new Map();
  for (const stmt of ast.program.body) {
    if (stmt.type !== "VariableDeclaration" || !stmt.declarations) continue;
    for (const d of stmt.declarations) {
      if (d.id.type !== "Identifier" || !d.init || d.init.type !== "ArrayExpression") continue;
      const items: ModuleArrayItem[] = [];
      for (const el of d.init.elements) {
        if (!el || el.type === "SpreadElement") continue;
        if (el.type === "ObjectExpression") items.push(evalObjectItem(el, constants));
      }
      if (items.length > 0) map.set(d.id.name, items);
    }
  }
  return map;
}

function evalNestedObjectMap(
  expr: ObjectExpression,
  constants?: Map<string, string | number>,
): Record<string, ModuleArrayItem> {
  const out: Record<string, ModuleArrayItem> = {};
  for (const prop of expr.properties) {
    if (prop.type !== "ObjectProperty") continue;
    const key =
      prop.key.type === "Identifier"
        ? prop.key.name
        : prop.key.type === "StringLiteral"
          ? prop.key.value
          : null;
    if (!key || prop.value.type !== "ObjectExpression") continue;
    out[key] = evalObjectItem(prop.value, constants);
  }
  return out;
}

/** Nested lookup tables used in `.map()` callbacks (`statusColors[trip.status]`). */
export function collectModuleNestedMaps(
  ast: File,
  constants?: Map<string, string | number>,
): ModuleNestedMaps {
  const map: ModuleNestedMaps = new Map();
  for (const stmt of ast.program.body) {
    if (stmt.type !== "VariableDeclaration") continue;
    for (const d of stmt.declarations) {
      if (d.id.type !== "Identifier" || !d.init || d.init.type !== "ObjectExpression") continue;
      const nested = evalNestedObjectMap(d.init, constants);
      if (Object.keys(nested).length > 0) map.set(d.id.name, nested);
    }
  }
  return map;
}

/** `activeTab === 'book'` and similar — condition cannot be evaluated at import time. */
export function isStateEqualityGuard(expr: Expression): boolean {
  const e = unwrapExpression(expr);
  if (e.type !== "BinaryExpression" || e.operator !== "===") return false;
  const left = unwrapOperand(e.left);
  if (!left) return false;
  return left.type === "Identifier" || left.type === "MemberExpression";
}

/** Resolve `className={active ? 'a' : 'b'}` and template literals. */
export function resolveClassNameFromExpression(
  expr: Expression | null | undefined,
  constants?: Map<string, string | number>,
  itemCtx?: { binding: string; item: ModuleArrayItem },
): string | undefined {
  if (!expr) return undefined;
  const e = unwrapExpression(expr);

  if (e.type === "StringLiteral") return e.value;

  if (e.type === "TemplateLiteral" && e.expressions.length === 0) {
    return e.quasis.map((q) => q.value.cooked ?? "").join("");
  }

  if (e.type === "ConditionalExpression") {
    if (itemCtx) {
      const cond = evalCondition(e.test, itemCtx.binding, itemCtx.item, constants);
      const branch = cond ? e.consequent : e.alternate;
      return resolveClassNameFromExpression(branch, constants, itemCtx);
    }
    const a = resolveClassNameFromExpression(e.consequent, constants);
    const b = resolveClassNameFromExpression(e.alternate, constants);
    return a && b ? `${a} ${b}` : (a ?? b);
  }

  if (e.type === "LogicalExpression" && e.operator === "&&") {
    return resolveClassNameFromExpression(e.right, constants, itemCtx);
  }

  return undefined;
}

function evalCondition(
  expr: Expression,
  binding: string,
  item: ModuleArrayItem,
  constants?: Map<string, string | number>,
): boolean {
  const e = unwrapExpression(expr);
  if (e.type === "BinaryExpression" && e.operator === "===") {
    const leftExpr = unwrapOperand(e.left);
    const rightExpr = unwrapOperand(e.right);
    if (!leftExpr || !rightExpr) return false;
    const left = memberValue(leftExpr, binding, item) ?? literalFromExpression(leftExpr, constants);
    const right =
      memberValue(rightExpr, binding, item) ?? literalFromExpression(rightExpr, constants);
    return left === right;
  }
  if (e.type === "MemberExpression") {
    const v = memberValue(e, binding, item);
    return Boolean(v);
  }
  const lit = literalFromExpression(e, constants);
  if (typeof lit === "boolean") return lit;
  return Boolean(lit);
}

function memberValue(
  expr: Expression,
  binding: string,
  item: ModuleArrayItem,
  extras?: Record<string, ModuleArrayItem>,
): string | number | boolean | undefined {
  const e = unwrapExpression(expr);
  if (e.type !== "MemberExpression" || e.object.type !== "Identifier") return undefined;
  const key = e.property.type === "Identifier" ? e.property.name : undefined;
  if (!key) return undefined;
  if (e.object.name === binding) return item[key];
  const bag = extras?.[e.object.name];
  if (bag && bag[key] !== undefined) return bag[key];
  return undefined;
}

function resolveLookupTableEntry(
  init: Expression,
  binding: string,
  item: ModuleArrayItem,
  nestedMaps: ModuleNestedMaps,
): ModuleArrayItem | undefined {
  const e = unwrapExpression(init);
  if (e.type !== "MemberExpression" || e.object.type !== "Identifier") return undefined;
  const table = nestedMaps.get(e.object.name);
  if (!table) return undefined;
  if (e.property.type === "MemberExpression") {
    const key = memberValue(e.property, binding, item);
    if (key !== undefined) return table[String(key)];
  }
  if (e.property.type === "StringLiteral") return table[e.property.value];
  if (e.property.type === "Identifier") return table[e.property.name];
  return undefined;
}

function extractBlockBindings(
  body: BlockStatement,
  binding: string,
  item: ModuleArrayItem,
  nestedMaps: ModuleNestedMaps,
): Record<string, ModuleArrayItem> {
  const extras: Record<string, ModuleArrayItem> = {};
  for (const stmt of body.body) {
    if (stmt.type !== "VariableDeclaration") continue;
    for (const d of stmt.declarations) {
      if (d.id.type !== "Identifier" || !d.init) continue;
      const row = resolveLookupTableEntry(d.init as Expression, binding, item, nestedMaps);
      if (row) extras[d.id.name] = row;
    }
  }
  return extras;
}

function resolveStyleValue(
  expr: Expression,
  binding: string,
  item: ModuleArrayItem,
  extras: Record<string, ModuleArrayItem>,
  constants?: Map<string, string | number>,
): string | number | undefined {
  const e = unwrapExpression(expr);
  const lit = literalFromExpression(e, constants);
  if (lit !== undefined && typeof lit !== "boolean") return lit;
  if (e.type === "MemberExpression") {
    const v = memberValue(e, binding, item, extras);
    if (v !== undefined && typeof v !== "boolean") return v;
  }
  if (e.type === "BinaryExpression" && e.operator === "+") {
    const leftOp = unwrapOperand(e.left);
    const rightOp = unwrapOperand(e.right);
    if (!leftOp || !rightOp) return undefined;
    const left = resolveStyleValue(leftOp, binding, item, extras, constants);
    const right = literalFromExpression(rightOp, constants);
    if (left !== undefined && typeof right === "string") return String(left) + right;
  }
  return undefined;
}

function resolveStyleObject(
  expr: ObjectExpression,
  binding: string,
  item: ModuleArrayItem,
  extras: Record<string, ModuleArrayItem>,
  constants?: Map<string, string | number>,
): ReactStyleRecord {
  const style: ReactStyleRecord = {};
  for (const prop of expr.properties) {
    if (prop.type !== "ObjectProperty") continue;
    const key =
      prop.key.type === "Identifier"
        ? prop.key.name
        : prop.key.type === "StringLiteral"
          ? prop.key.value
          : null;
    if (!key) continue;
    const val = resolveStyleValue(prop.value as Expression, binding, item, extras, constants);
    if (val !== undefined) style[key] = val;
  }
  return style;
}

function styleRecordToObjectExpression(style: ReactStyleRecord): ObjectExpression {
  const properties: ObjectProperty[] = Object.entries(style).map(([key, value]) => ({
    type: "ObjectProperty" as const,
    key: { type: "Identifier" as const, name: key },
    value:
      typeof value === "number"
        ? { type: "NumericLiteral" as const, value }
        : { type: "StringLiteral" as const, value: String(value) },
    computed: false,
    shorthand: false,
  }));
  return { type: "ObjectExpression", properties };
}

function jsxFromArrowBody(
  body: ArrowFunctionExpression["body"],
): JSXElement | null {
  if (body.type === "JSXElement") return body;
  if (body.type === "BlockStatement") {
    for (const stmt of body.body) {
      if (stmt.type === "ReturnStatement" && stmt.argument?.type === "JSXElement") {
        return stmt.argument;
      }
    }
  }
  return null;
}

function substituteJsxElement(
  el: JSXElement,
  binding: string,
  item: ModuleArrayItem,
  constants?: Map<string, string | number>,
  extras: Record<string, ModuleArrayItem> = {},
): JSXElement {
  const attrs = el.openingElement.attributes.map((attr) => {
    if (attr.type !== "JSXAttribute" || attr.name.type !== "JSXIdentifier") return attr;
    if (!attr.value || attr.value.type !== "JSXExpressionContainer") return attr;

    if (attr.name.name === "className") {
      if (attr.value.expression.type === "JSXEmptyExpression") return attr;
      const cn = resolveClassNameFromExpression(attr.value.expression, constants, { binding, item });
      if (!cn) return attr;
      return { ...attr, value: { type: "StringLiteral" as const, value: cn } } satisfies JSXAttribute;
    }

    if (attr.name.name === "style" && attr.value.expression.type === "ObjectExpression") {
      const style = resolveStyleObject(
        attr.value.expression,
        binding,
        item,
        extras,
        constants,
      );
      if (Object.keys(style).length === 0) return attr;
      return {
        ...attr,
        value: {
          type: "JSXExpressionContainer" as const,
          expression: styleRecordToObjectExpression(style),
        },
      } satisfies JSXAttribute;
    }

    return attr;
  });

  const children: JSXChild[] = el.children.flatMap((ch): JSXChild[] => {
    if (ch.type === "JSXElement") return [substituteJsxElement(ch, binding, item, constants, extras)];
    if (ch.type === "JSXExpressionContainer") {
      const sub = substituteExpressionChild(ch, binding, item, constants, extras);
      if (sub === null) return [];
      return [sub];
    }
    return [ch];
  });

  return {
    ...el,
    openingElement: {
      ...el.openingElement,
      attributes: attrs as (JSXAttribute | JSXSpreadAttribute)[],
    },
    closingElement: el.closingElement,
    children,
  };
}

function substituteExpressionChild(
  ch: JSXExpressionContainer,
  binding: string,
  item: ModuleArrayItem,
  constants?: Map<string, string | number>,
  extras: Record<string, ModuleArrayItem> = {},
): JSXExpressionContainer | JSXElement | null {
  const ex = ch.expression;
  if (ex.type === "JSXElement") return substituteJsxElement(ex, binding, item, constants, extras);
  if (ex.type === "MemberExpression") {
    const v = memberValue(ex, binding, item, extras);
    if (v !== undefined) {
      return { type: "JSXExpressionContainer", expression: { type: "StringLiteral", value: String(v) } };
    }
  }
  if (ex.type === "LogicalExpression" && ex.operator === "&&") {
    const leftOk = evalCondition(ex.left, binding, item, constants);
    if (leftOk && ex.right.type === "JSXElement") {
      return substituteJsxElement(ex.right, binding, item, constants, extras);
    }
    return null;
  }
  return null;
}

function arrowBlock(body: ArrowFunctionExpression["body"] | FunctionExpression["body"]): BlockStatement | null {
  return body.type === "BlockStatement" ? body : null;
}

/** Expand `{items.map(x => <El />)}` using module-level array literals. */
export function expandMapExpression(
  expr: Expression,
  arrays: ModuleArrays,
  constants?: Map<string, string | number>,
  nestedMaps?: ModuleNestedMaps,
): JSXElement[] | null {
  const e = unwrapExpression(expr);
  if (e.type !== "CallExpression") return null;
  const callee = e.callee;
  if (callee.type !== "MemberExpression" || callee.property.type !== "Identifier") return null;
  if (callee.property.name !== "map") return null;
  if (callee.object.type !== "Identifier") return null;

  const items = arrays.get(callee.object.name);
  if (!items?.length) return null;

  const cb = e.arguments[0];
  if (!cb || cb.type === "SpreadElement") return null;
  if (cb.type !== "ArrowFunctionExpression" && cb.type !== "FunctionExpression") return null;

  const param = cb.params[0];
  if (!param || param.type !== "Identifier") return null;
  const binding = param.name;

  const template = jsxFromArrowBody(cb.body);
  if (!template) return null;

  const block = arrowBlock(cb.body);
  const maps = nestedMaps ?? new Map();

  return items.map((item) => {
    const extras = block ? extractBlockBindings(block, binding, item, maps) : {};
    return substituteJsxElement(template, binding, item, constants, extras);
  });
}
