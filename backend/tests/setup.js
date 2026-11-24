const path = require("node:path");
const dotenv = require("dotenv");

const testConfig = dotenv.config({ path: path.resolve(__dirname, "../.env.test"), processEnv: {} }).parsed;
const testDatabaseUrl = process.env.TEST_DATABASE_URL || testConfig?.DATABASE_URL;
let database;
try {
  database = new URL(testDatabaseUrl);
} catch {
  throw new Error("Define TEST_DATABASE_URL o DATABASE_URL en backend/.env.test para ejecutar las pruebas.");
}

// Los tests vacían las tablas entre casos. Exige una base dedicada incluso si DATABASE_URL
// ya está definida en el entorno para desarrollo o producción.
if (!/^postgres(?:ql)?:$/.test(database.protocol) || !/^\/[a-zA-Z0-9_-]+_test$/.test(database.pathname)) {
  throw new Error("Las pruebas requieren una base PostgreSQL cuyo nombre termine en _test.");
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = testDatabaseUrl;
process.env.JWT_SECRET = testConfig?.JWT_SECRET || "inventario-secret-solo-para-test";
