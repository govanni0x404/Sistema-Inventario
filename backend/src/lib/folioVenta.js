const HttpError = require("./HttpError");

function filtroFolio(folio) {
  if (folio === undefined || folio === "") return {};
  if (typeof folio !== "string" || !/^[a-f\d-]{1,36}$/i.test(folio.trim())) {
    throw new HttpError(400, "Escribe un folio válido del comprobante.");
  }
  return { id: { startsWith: folio.trim().toLowerCase() } };
}

module.exports = { filtroFolio };
