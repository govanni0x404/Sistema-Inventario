// Corre antes de que cualquier test importe la app: fuerza a Prisma y al resto del código
// a usar la base de datos de pruebas (`inventario_test`), nunca la de desarrollo.
process.env.NODE_ENV = "test";
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env.test"), override: true });
