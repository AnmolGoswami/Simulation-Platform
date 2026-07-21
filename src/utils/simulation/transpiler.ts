/**
 * Transpiles Arduino/ESP32 C++ code into asynchronous JavaScript
 * so it can be executed natively in the browser runtime.
 */
export function transpileArduinoToJS(code: string): { jsCode: string; customFunctions: string[] } {
  // Step 1: Strip comments to prevent matching keywords inside comments
  let cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '') // Strip block comments
    .replace(/\/\/.*/g, '')           // Strip line comments

  // Step 1.2: Strip C++ storage specifiers and attributes that are not compatible with JS
  // e.g. volatile, static, inline, register, extern, and ESP32 interrupts IRAM_ATTR
  cleanCode = cleanCode.replace(/\b(volatile|static|register|extern|inline|IRAM_ATTR|DRAM_ATTR|RTC_DATA_ATTR)\b/g, '')

  const customFunctions: string[] = []

  // Step 2: Extract and replace class instantiations
  // e.g. LiquidCrystal_I2C lcd(0x27, 16, 2); -> let lcd = new LiquidCrystal_I2C(0x27, 16, 2);
  // e.g. DallasTemperature sensors(&oneWire); -> let sensors = new DallasTemperature(oneWire);
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

    const regex = new RegExp(`\\b${cls}\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(([^)]*)\\)\\s*;`, 'g')
    cleanCode = cleanCode.replace(regex, (_, name, args) => {
      // Strip address-of operator '&' from args for JS compatibility
      const cleanArgs = args.replace(/&\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1')
      return `let ${name} = new ${cls}(${cleanArgs});`
    })
  })

  // Step 3: Find and transpile function declarations
  // e.g. void setup() { ... } -> async function setup() { ... }
  // e.g. int calculate(int a, float b) { ... } -> async function calculate(a, b) { ... }
  const funcRegex = /\b(void|unsigned\s+int|unsigned\s+long|unsigned|int|float|double|long|short|char|bool|boolean|byte|uint8_t|uint16_t|uint32_t|uint64_t|int16_t|int32_t|int64_t|size_t|String)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/g
  
  let match
  const tempDeclarations: { fullMatch: string; name: string; params: string }[] = []
  
  // Find all functions first
  while ((match = funcRegex.exec(cleanCode)) !== null) {
    const [fullMatch, , name, params] = match
    tempDeclarations.push({ fullMatch, name, params })
    if (name !== 'setup' && name !== 'loop') {
      customFunctions.push(name)
    }
  }

  // Replace function declarations
  tempDeclarations.forEach(({ fullMatch, name, params }) => {
    // Strip type keywords from parameter list (e.g. "int pin, float val" -> "pin, val")
    const cleanParams = params
      .split(',')
      .map((p) => {
        const parts = p.trim().split(/\s+/)
        let paramName = parts[parts.length - 1] // Keep only the parameter name
        // Strip any leading pointers (*) or references (&) from the parameter name for JS compatibility
        paramName = paramName.replace(/^[&*]+/, '')
        return paramName
      })
      .filter(Boolean)
      .join(', ')

    cleanCode = cleanCode.replace(fullMatch, `async function ${name}(${cleanParams}) {`)
  })

  // Step 3.5: Strip unary address-of operator '&' from arguments (e.g. &oneWire -> oneWire)
  // this is safe for bitwise AND (&) and logical AND (&&) as it checks bounds.
  cleanCode = cleanCode.replace(/(?<!\w)(?<!&)&(?!&)\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g, '$1')

  const types = [
    'unsigned char', 'unsigned short', 'unsigned int', 'unsigned long', 'unsigned byte', 'unsigned',
    'uint8_t', 'uint16_t', 'uint32_t', 'uint64_t', 'int16_t', 'int32_t', 'int64_t', 'size_t',
    'int', 'float', 'double', 'long', 'short', 'char', 'bool', 'boolean', 'byte', 'String'
  ].sort((a, b) => b.length - a.length)

  // Step 3.7: Strip C++ style type casts (e.g. (int)val -> val, (OneWire*)ds -> ds)
  const castTypes = [...types, ...classPatterns]
  castTypes.forEach((type) => {
    const typeRegexStr = type.replace(/\s+/g, '\\s+')
    const castRegex = new RegExp(`\\(\\s*${typeRegexStr}\\s*\\*?\\s*\\)`, 'g')
    cleanCode = cleanCode.replace(castRegex, '')
  })

  // Step 4: Replace primitive types in variable declarations
  // e.g. const int led = 13; -> const led = 13;
  // e.g. int val = 0; -> let val = 0;
  types.forEach((type) => {
    const typeRegexStr = type.replace(/\s+/g, '\\s+')
    // Const declarations
    const constRegex = new RegExp(`\\bconst\\s+${typeRegexStr}\\b`, 'g')
    cleanCode = cleanCode.replace(constRegex, 'const')

    // Const pointer declarations: e.g. const int* p -> const p
    const constPtrRegex = new RegExp(`\\bconst\\s+${typeRegexStr}\\s*\\*\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g')
    cleanCode = cleanCode.replace(constPtrRegex, 'const $1')

    // Regular pointer declarations: e.g. int* p -> let p
    const ptrRegex = new RegExp(`\\b${typeRegexStr}\\s*\\*\\s*([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g')
    cleanCode = cleanCode.replace(ptrRegex, 'let $1')

    // Regular declarations — only match type declarations when followed by a variable identifier
    const varRegex = new RegExp(`\\b${typeRegexStr}\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g')
    cleanCode = cleanCode.replace(varRegex, 'let $1')
  })

  // Step 4.5: Inject cooperative multitasking _yield() checks inside loops
  // to prevent browser thread freeze during long or infinite loops
  cleanCode = cleanCode.replace(/\bwhile\s*\((.+?)\)\s*\{/g, 'while ($1) { await _yield();')
  cleanCode = cleanCode.replace(/\bfor\s*\((.+?)\)\s*\{/g, 'for ($1) { await _yield();')
  cleanCode = cleanCode.replace(/\bdo\s*\{/g, 'do { await _yield();')

  // Step 5: Replace C++ array declarations
  // e.g. let pins[] = {2, 3, 4}; -> let pins = [2, 3, 4];
  // e.g. let values[3] = {10, 20, 30}; -> let values = [10, 20, 30];
  cleanCode = cleanCode.replace(
    /\b(let|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\d*\s*\]\s*=\s*\{([^}]+)\}\s*;/g,
    '$1 $2 = [$3];'
  )

  // Step 5.5: Replace C++ uninitialized array declarations (e.g. let temp[3]; -> let temp = [];)
  cleanCode = cleanCode.replace(
    /\b(let|const)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\[\s*\d*\s*\]\s*;/g,
    '$1 $2 = [];'
  )

  // Step 6: Inject await for delay calls
  // delay(1000); -> await delay(1000);
  cleanCode = cleanCode.replace(/\bdelay\(([^)]+)\)\s*;/g, 'await delay($1);')
  cleanCode = cleanCode.replace(/\bdelayMicroseconds\(([^)]+)\)\s*;/g, 'await delayMicroseconds($1);')

  // Step 7: Inject await for user custom function calls
  // e.g. flashLed(); -> await flashLed();
  customFunctions.forEach((funcName) => {
    const callRegex = new RegExp(`(?<!async\\s+function\\s+)(?<!function\\s+)\\b${funcName}\\s*\\(([^)]*)\\)\\s*;`, 'g')
    cleanCode = cleanCode.replace(callRegex, `await ${funcName}($1);`)
  })

  // Step 8: Replace #include directives with comments/nothing
  cleanCode = cleanCode.replace(/#include\s+<[^>]+>/g, '')
  cleanCode = cleanCode.replace(/#include\s+"[^"]+"/g, '')
  
  // Step 9: Replace #define constants
  // e.g. #define LED_PIN 13 -> const LED_PIN = 13;
  cleanCode = cleanCode.replace(/#define\s+([a-zA-Z0-9_]+)\s+([^\n\r]+)/g, 'const $1 = $2;')

  // Step 9.5: Strip F() flash memory macros (e.g. F("hello") -> "hello")
  cleanCode = cleanCode.replace(/\bF\(([^)]+)\)/g, '$1')

  // Step 10: Map digital state and mode constants if not already declared
  // Make sure setup and loop are returned as properties of the execution
  const wrapperCode = `
    ${cleanCode}
    return {
      setup: typeof setup !== 'undefined' ? setup : async () => {},
      loop: typeof loop !== 'undefined' ? loop : async () => {}
    };
  `

  return { jsCode: wrapperCode, customFunctions }
}
