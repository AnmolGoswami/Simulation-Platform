/**
 * Transpiles Arduino/ESP32 C++ code into asynchronous JavaScript
 * so it can be executed natively in the browser runtime.
 */

// ────────────────────────────────────────────────────────────────
// Balanced-scanning utilities
//
// The naive approach ( regexes like `\(([^)]+)\)` ) assumes the
// first `)` it sees closes the call/loop it's looking at. That's
// false as soon as there's a nested call (`delay(random(1,2))`),
// a bracket inside a condition (`faulty[i]`), or a braceless
// single-statement loop body (`for (...) if (...) x++;`) — the
// naive version either mismatches or, worse, keeps scanning past
// the intended end and swallows unrelated code. Everything below
// counts actual nesting depth and skips over string/char literals
// so quoted `)`/`(`/`{`/`}` never throw the count off.
// ────────────────────────────────────────────────────────────────

/**
 * Given `code[start] === open`, returns the index just past the
 * matching `close`, skipping over string/char literal contents.
 * Returns -1 if unbalanced (caller should bail out gracefully
 * rather than risk corrupting the rest of the file).
 */
function findMatchingBracket(code: string, start: number, open: string, close: string): number {
  let depth = 0
  let i = start
  while (i < code.length) {
    const ch = code[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return i + 1
    }
    i++
  }
  return -1
}

/** Extracts the argument text of a call, given the index of its opening `(`. */
function extractCallArgs(code: string, parenOpenIndex: number): { args: string; endIndex: number } | null {
  const end = findMatchingBracket(code, parenOpenIndex, '(', ')')
  if (end === -1) return null
  return { args: code.slice(parenOpenIndex + 1, end - 1), endIndex: end }
}

/**
 * Splits a call's argument text on top-level commas — i.e. commas that
 * aren't nested inside `()`/`[]`/`{}` or inside a string/char literal.
 * Used for Arduino APIs (like `String::replace(a, b)`) where we need
 * the individual arguments rather than the whole args blob.
 */
function splitTopLevelArgs(args: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  let i = 0
  while (i < args.length) {
    const ch = args[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      current += ch
      i++
      while (i < args.length && args[i] !== quote) {
        if (args[i] === '\\') {
          current += args[i]
          i++
        }
        current += args[i]
        i++
      }
      if (i < args.length) {
        current += args[i]
        i++
      }
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) {
      parts.push(current)
      current = ''
      i++
      continue
    }
    current += ch
    i++
  }
  if (current.trim() !== '' || parts.length > 0) parts.push(current)
  return parts
}

/**
 * Finds every call to `name(...)` in `code` and replaces it using
 * `transform(args, fullMatchedCallText)`. Correctly handles nested
 * parens in the arguments (unlike a `[^)]+` regex).
 *
 * `skipIfPrecededByFunctionKeyword`: when true, skips call sites
 * that are actually the function's own declaration (e.g. avoids
 * turning `async function readTemp(` into an awaited call).
 */
function replaceCalls(
  code: string,
  name: string,
  transform: (args: string, matchText: string) => string,
  options: { skipIfPrecededByFunctionKeyword?: boolean } = {}
): string {
  const nameRegex = new RegExp(`\\b${name}\\s*\\(`, 'g')
  let result = ''
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = nameRegex.exec(code)) !== null) {
    const matchStart = match.index
    const parenOpen = matchStart + match[0].length - 1

    if (options.skipIfPrecededByFunctionKeyword) {
      const before = code.slice(Math.max(0, matchStart - 20), matchStart)
      if (/(async\s+function\s+|function\s+)$/.test(before)) {
        result += code.slice(cursor, parenOpen + 1)
        cursor = parenOpen + 1
        nameRegex.lastIndex = parenOpen + 1
        continue
      }
    }

    const extracted = extractCallArgs(code, parenOpen)
    if (!extracted) break // unbalanced — bail out rather than corrupt the rest

    const matchText = code.slice(matchStart, extracted.endIndex)
    result += code.slice(cursor, matchStart) + transform(extracted.args, matchText)
    cursor = extracted.endIndex
    nameRegex.lastIndex = extracted.endIndex
  }
  result += code.slice(cursor)
  return result
}

/**
 * Finds every call to `receiver.methodName(...)` — an instance method
 * call, as opposed to `replaceCalls`'s bare-function form — and rewrites
 * it via `wrap(receiverText, argsText)`. The receiver is matched
 * conservatively as a dotted/indexed identifier chain immediately before
 * the `.methodName(` (e.g. `foo`, `arr[i]`, `sensors[i].name`). Call
 * sites whose receiver isn't a simple chain (e.g. the result of another
 * call, like `getName().toInt()`) are intentionally left untouched
 * rather than risk mis-scanning — those are rare in Arduino sketches
 * and safer to leave for the person to rewrite by hand.
 */
function replaceStringMethodCalls(
  code: string,
  methodName: string,
  wrap: (receiver: string, args: string) => string
): string {
  const receiverPattern = /[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*|\[[^[\]]*])*$/
  const callRegex = new RegExp(`\\.${methodName}\\s*\\(`, 'g')
  let result = ''
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = callRegex.exec(code)) !== null) {
    const dotStart = match.index
    const before = code.slice(0, dotStart)
    const recMatch = before.match(receiverPattern)
    if (!recMatch) continue // no clean receiver — leave this call site untouched

    const receiverStart = dotStart - recMatch[0].length
    const receiver = recMatch[0]
    const parenOpen = dotStart + match[0].length - 1
    const extracted = extractCallArgs(code, parenOpen)
    if (!extracted) break // unbalanced — bail out rather than corrupt the rest

    result += code.slice(cursor, receiverStart) + wrap(receiver, extracted.args)
    cursor = extracted.endIndex
    callRegex.lastIndex = extracted.endIndex
  }
  result += code.slice(cursor)
  return result
}

/**
 * Given the start index of a statement, returns the index just past
 * its end. Handles plain `...;` statements, and — critically — braceless
 * control-flow bodies (`if (...) x++;`, optionally with `else ...;`),
 * so a braceless `for`/`while` body that is itself an `if` doesn't get
 * truncated mid-statement.
 */
function findStatementEnd(code: string, start: number): number {
  let i = start
  while (i < code.length && /\s/.test(code[i])) i++

  const rest = code.slice(i)
  const ctrlMatch = rest.match(/^(if|for|while)\s*\(/)
  if (ctrlMatch) {
    const parenOpen = i + ctrlMatch[0].length - 1
    const headerEnd = findMatchingBracket(code, parenOpen, '(', ')')
    if (headerEnd === -1) return -1

    let bodyStart = headerEnd
    while (bodyStart < code.length && /\s/.test(code[bodyStart])) bodyStart++

    let bodyEnd: number
    if (code[bodyStart] === '{') {
      bodyEnd = findMatchingBracket(code, bodyStart, '{', '}')
      if (bodyEnd === -1) return -1
    } else {
      bodyEnd = findStatementEnd(code, bodyStart)
      if (bodyEnd === -1) return -1
    }

    // `if` can carry a trailing `else` clause as part of the same statement.
    if (ctrlMatch[1] === 'if') {
      let j = bodyEnd
      while (j < code.length && /\s/.test(code[j])) j++
      if (code.slice(j, j + 4) === 'else') {
        let elseBodyStart = j + 4
        while (elseBodyStart < code.length && /\s/.test(code[elseBodyStart])) elseBodyStart++
        if (code[elseBodyStart] === '{') {
          const elseEnd = findMatchingBracket(code, elseBodyStart, '{', '}')
          return elseEnd === -1 ? bodyEnd : elseEnd
        }
        const elseEnd = findStatementEnd(code, elseBodyStart)
        return elseEnd === -1 ? bodyEnd : elseEnd
      }
    }
    return bodyEnd
  }

  // Plain statement — scan to the first top-level `;`.
  let depth = 0
  while (i < code.length) {
    const ch = code[i]
    if (ch === '"' || ch === "'") {
      const quote = ch
      i++
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') i++
        i++
      }
      i++
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') depth++
    else if (ch === ')' || ch === ']' || ch === '}') depth--
    else if (ch === ';' && depth === 0) return i + 1
    i++
  }
  return -1
}

/**
 * Injects a cooperative `await _yield();` at the top of every
 * `for`/`while` loop body, correctly handling nested parens in the
 * loop header and braceless single-statement bodies. Skips bare
 * `while (cond);` trailers (do-while tails) untouched, matching the
 * original transpiler's conservative behavior there.
 */
function injectYieldIntoLoops(code: string, keyword: 'for' | 'while'): string {
  const kwRegex = new RegExp(`\\b${keyword}\\s*\\(`, 'g')
  let result = ''
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = kwRegex.exec(code)) !== null) {
    const kwStart = match.index
    const parenOpen = kwStart + match[0].length - 1
    const headerEnd = findMatchingBracket(code, parenOpen, '(', ')')
    if (headerEnd === -1) break

    let bodyStart = headerEnd
    while (bodyStart < code.length && /\s/.test(code[bodyStart])) bodyStart++

    if (code[bodyStart] === ';') {
      // Bare-semicolon body — most likely a do-while's `while (cond);`
      // tail. Leave it untouched rather than risk misreading it.
      kwRegex.lastIndex = bodyStart + 1
      continue
    }

    const header = code.slice(parenOpen + 1, headerEnd - 1)
    result += code.slice(cursor, kwStart) + `${keyword} (${header}) `

    if (code[bodyStart] === '{') {
      const bodyEnd = findMatchingBracket(code, bodyStart, '{', '}')
      if (bodyEnd === -1) break
      result += '{ await _yield();' + code.slice(bodyStart + 1, bodyEnd)
      cursor = bodyEnd
      kwRegex.lastIndex = bodyEnd
    } else {
      // Braceless single-statement body — e.g. `for (...) if (...) x++;`
      const stmtEnd = findStatementEnd(code, bodyStart)
      if (stmtEnd === -1) break
      result += '{ await _yield(); ' + code.slice(bodyStart, stmtEnd) + ' }'
      cursor = stmtEnd
      kwRegex.lastIndex = stmtEnd
    }
  }
  result += code.slice(cursor)
  return result
}

export function transpileArduinoToJS(code: string): { jsCode: string; customFunctions: string[] } {
  // Step 1: Strip comments to prevent matching keywords inside comments
  let cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Strip block comments
    .replace(/\/\/.*/g, '')           // Strip line comments

  // Step 1.1: Strip C++ storage specifiers and attributes not compatible with JS
  cleanCode = cleanCode.replace(/\b(volatile|static|register|extern|inline|IRAM_ATTR|DRAM_ATTR|RTC_DATA_ATTR)\b/g, '')

  // Step 1.2: Arduino's `String` is a class and `.length()` is a *method*
  // call; a transpiled JS string exposes `.length` as a plain *property*.
  // Left alone, `text.length()` throws "text.length is not a function" at
  // runtime — calling it as a function is invalid, since `.length` isn't
  // callable on a JS string. Empty-paren `.length()` is unambiguous (no
  // other Arduino API has that exact call shape), so a plain regex is safe.
  cleanCode = cleanCode.replace(/\.length\s*\(\s*\)/g, '.length')

  // Step 1.3: Arduino `String` methods that have no direct JS-string
  // equivalent. Each is rewritten at the call site rather than by
  // patching String.prototype globally — this app's transpiled sketches
  // run in the same JS realm as the rest of the page, so monkey-patching
  // built-ins here could leak out and break unrelated code elsewhere.
  cleanCode = replaceStringMethodCalls(cleanCode, 'toInt', (receiver) => `(parseInt(${receiver}, 10) || 0)`)
  cleanCode = replaceStringMethodCalls(cleanCode, 'toFloat', (receiver) => `(parseFloat(${receiver}) || 0)`)
  cleanCode = replaceStringMethodCalls(
    cleanCode,
    'equalsIgnoreCase',
    (receiver, args) => `(${receiver}.toLowerCase() === (${args}).toLowerCase())`
  )
  cleanCode = replaceStringMethodCalls(cleanCode, 'equals', (receiver, args) => `(${receiver} === (${args}))`)
  cleanCode = replaceStringMethodCalls(
    cleanCode,
    'compareTo',
    (receiver, args) => `(${receiver} < (${args}) ? -1 : ${receiver} > (${args}) ? 1 : 0)`
  )

  // Step 1.4: Arduino's `String::replace(a, b)` mutates the string in
  // place and replaces ALL occurrences, and is almost always called as a
  // bare statement: `str.replace(old, new);`. JS strings are immutable,
  // so left as-is the call would silently do nothing. This detects
  // exactly that "receiver.replace(args);" statement form (two args,
  // used as a standalone statement) and rewrites it into a reassignment
  // using split/join, which matches Arduino's "replace all" semantics
  // (JS's built-in two-arg String.replace only replaces the first match).
  // Non-statement or non-2-arg usages are left untouched.
  {
    const replaceRegex = /\.replace\s*\(/g
    const receiverPattern = /[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*|\[[^[\]]*])*$/
    let result = ''
    let cursor = 0
    let m: RegExpExecArray | null

    while ((m = replaceRegex.exec(cleanCode)) !== null) {
      const dotStart = m.index
      const before = cleanCode.slice(0, dotStart)
      const recMatch = before.match(receiverPattern)
      if (!recMatch) continue

      const receiverStart = dotStart - recMatch[0].length
      const receiver = recMatch[0]
      const parenOpen = dotStart + m[0].length - 1
      const extracted = extractCallArgs(cleanCode, parenOpen)
      if (!extracted) break

      let k = extracted.endIndex
      while (k < cleanCode.length && /\s/.test(cleanCode[k])) k++
      if (cleanCode[k] !== ';') {
        // Not a bare statement (e.g. used inside an expression) — the
        // split/join rewrite only makes sense as a reassignment, so
        // leave this call site untouched rather than guess.
        replaceRegex.lastIndex = extracted.endIndex
        continue
      }

      const parts = splitTopLevelArgs(extracted.args)
      if (parts.length !== 2) {
        replaceRegex.lastIndex = extracted.endIndex
        continue
      }

      const [find, replacement] = parts
      result +=
        cleanCode.slice(cursor, receiverStart) +
        `${receiver} = ${receiver}.split(${find.trim()}).join(${replacement.trim()});`
      cursor = k + 1
      replaceRegex.lastIndex = k + 1
    }
    result += cleanCode.slice(cursor)
    cleanCode = result
  }

  const customFunctions: string[] = []

  // Step 1.8: Parse C++ enum declarations into const assignments
  const enumRegex = /\benum\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\{([^}]+)\}\s*;/g
  let enumMatch
  const enumTypes: string[] = []

  let enumCleanedCode = cleanCode
  while ((enumMatch = enumRegex.exec(cleanCode)) !== null) {
    const [fullMatch, enumName, body] = enumMatch
    enumTypes.push(enumName)

    let index = 0
    const consts = body.split(',').map((valStr) => {
      const parts = valStr.trim().split('=')
      const name = parts[0].trim()
      if (parts[1]) {
        index = parseInt(parts[1].trim(), 10)
      }
      const decl = `const ${name} = ${index};`
      index++
      return decl
    })

    enumCleanedCode = enumCleanedCode.replace(fullMatch, consts.join(' '))
  }
  cleanCode = enumCleanedCode

  // Step 2: Extract and replace class instantiations
  // e.g. LiquidCrystal_I2C lcd(0x27, 16, 2); -> let lcd = new LiquidCrystal_I2C(0x27, 16, 2);
  const classPatterns = [
    'LiquidCrystal_I2C',
    'Adafruit_SSD1306',
    'Adafruit_SH1106G',
    'DHT',
    'OneWire',
    'DallasTemperature',
  ]

  classPatterns.forEach((cls) => {
    // Pointer declarations: e.g. OneWire* ds; -> let ds;
    const ptrRegex = new RegExp(`\\b${cls}\\s*\\*\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g')
    cleanCode = cleanCode.replace(ptrRegex, 'let $1')

    // Instance declarations with constructor args, using balanced-paren
    // scanning so nested calls in the args don't break the match.
    const declRegex = new RegExp(`\\b${cls}\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(`, 'g')
    let result = ''
    let cursor = 0
    let m: RegExpExecArray | null

    while ((m = declRegex.exec(cleanCode)) !== null) {
      const varName = m[1]
      const parenOpen = m.index + m[0].length - 1
      const extracted = extractCallArgs(cleanCode, parenOpen)
      if (!extracted) break

      let k = extracted.endIndex
      while (k < cleanCode.length && /\s/.test(cleanCode[k])) k++
      if (cleanCode[k] !== ';') {
        // Not actually a declaration statement — leave untouched.
        declRegex.lastIndex = extracted.endIndex
        continue
      }

      const cleanArgs = extracted.args.replace(/&\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1')
      result += cleanCode.slice(cursor, m.index) + `let ${varName} = new ${cls}(${cleanArgs});`
      cursor = k + 1
      declRegex.lastIndex = k + 1
    }
    result += cleanCode.slice(cursor)
    cleanCode = result
  })

  // Step 3: Find and transpile function declarations
  const funcRegex = /\b(void|unsigned\s+int|unsigned\s+long|unsigned|int|float|double|long|short|char|bool|boolean|byte|uint8_t|uint16_t|uint32_t|uint64_t|int16_t|int32_t|int64_t|size_t|String)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g

  let match
  const tempDeclarations: { fullMatch: string; name: string; params: string }[] = []

  while ((match = funcRegex.exec(cleanCode)) !== null) {
    const [fullMatch, , name, params] = match
    tempDeclarations.push({ fullMatch, name, params })
    if (name !== 'setup' && name !== 'loop') {
      customFunctions.push(name)
    }
  }

  tempDeclarations.forEach(({ fullMatch, name, params }) => {
    const cleanParams = params
      .split(',')
      .map((p) => {
        const parts = p.trim().split(/\s+/)
        let paramName = parts[parts.length - 1]
        paramName = paramName.replace(/^[&*]+/, '')
        return paramName
      })
      .filter(Boolean)
      .join(', ')

    cleanCode = cleanCode.replace(fullMatch, `async function ${name}(${cleanParams}) {`)
  })

  // Step 3.5: Strip unary address-of operator '&' from arguments
  cleanCode = cleanCode.replace(/(?<!\w)(?<!&)&(?!&)\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g, '$1')

  const types = [
    ...enumTypes,
    'unsigned char', 'unsigned short', 'unsigned int', 'unsigned long', 'unsigned byte', 'unsigned',
    'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int16_t', 'int32_t', 'int64_t', 'size_t',
    'int', 'float', 'double', 'long', 'short', 'char', 'bool', 'boolean', 'byte', 'String'
  ].sort((a, b) => b.length - a.length)

  // Step 3.7: Strip C++ style type casts (e.g. (int)val -> val, (char)223 -> 223)
  const castTypes = [...types, ...classPatterns]
  castTypes.forEach((type) => {
    const typeRegexStr = type.replace(/\s+/g, '\\s+')
    const castRegex = new RegExp(`\\(\\s*${typeRegexStr}\\s*\\*?\\s*\\)`, 'g')
    cleanCode = cleanCode.replace(castRegex, '')
  })

  // Step 4: Replace primitive types in variable declarations
  types.forEach((type) => {
    const typeRegexStr = type.replace(/\s+/g, '\\s+')
    const constRegex = new RegExp(`\\bconst\\s+${typeRegexStr}\\b`, 'g')
    cleanCode = cleanCode.replace(constRegex, 'const')

    const constPtrRegex = new RegExp(`\\bconst\\s+${typeRegexStr}\\s*\\*\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g')
    cleanCode = cleanCode.replace(constPtrRegex, 'const $1')

    const ptrRegex = new RegExp(`\\b${typeRegexStr}\\s*\\*\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g')
    cleanCode = cleanCode.replace(ptrRegex, 'let $1')

    const varRegex = new RegExp(`\\b${typeRegexStr}\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g')
    cleanCode = cleanCode.replace(varRegex, 'let $1')
  })

  // Step 4.5: Inject cooperative multitasking _yield() checks inside loops
  // — now using balanced-paren/brace scanning so nested conditions and
  // braceless single-statement bodies transpile correctly.
  cleanCode = injectYieldIntoLoops(cleanCode, 'while')
  cleanCode = injectYieldIntoLoops(cleanCode, 'for')
  cleanCode = cleanCode.replace(/\bdo\s*\{/g, 'do { await _yield();')

  // Step 5: Replace C++ array declarations with initializers
  cleanCode = cleanCode.replace(
    /\b(let|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]+)\}\s*;/g,
    '$1 $2 = [$3];'
  )

  // Step 5.5: Replace C++ uninitialized array declarations
  cleanCode = cleanCode.replace(
    /\b(let|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\d*\s*\]\s*;/g,
    '$1 $2 = [];'
  )

  // Step 6: Inject await for delay calls (balanced-paren aware, so
  // e.g. `delay(random(500, 1000));` transpiles correctly)
  cleanCode = replaceCalls(cleanCode, 'delay', (args) => `await delay(${args})`)
  cleanCode = replaceCalls(cleanCode, 'delayMicroseconds', (args) => `await delayMicroseconds(${args})`)

  // Step 7: Inject await for user custom function calls (balanced-paren
  // aware; skips the function's own declaration line)
  customFunctions.forEach((funcName) => {
    cleanCode = replaceCalls(
      cleanCode,
      funcName,
      (_args, matchText) => `await ${matchText}`,
      { skipIfPrecededByFunctionKeyword: true }
    )
  })

  // Step 8: Replace #include directives with nothing
  cleanCode = cleanCode.replace(/#include\s+<[^>]+>/g, '')
  cleanCode = cleanCode.replace(/#include\s+"[^"]+"/g, '')

  // Step 9: Replace #define constants
  cleanCode = cleanCode.replace(/#define\s+([a-zA-Z0-9_]+)\s+([^\n\r]+)/g, 'const $1 = $2;')

  // Step 9.5: Strip F() flash memory macros (balanced-paren aware)
  cleanCode = replaceCalls(cleanCode, 'F', (args) => args)

  // Step 10: Wrap so setup/loop are returned as properties of the execution
  const wrapperCode = `
    ${cleanCode}
    return {
      setup: typeof setup !== 'undefined' ? setup : async () => {},
      loop: typeof loop !== 'undefined' ? loop : async () => {}
    };
  `

  return { jsCode: wrapperCode, customFunctions }
}