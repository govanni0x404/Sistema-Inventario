const { z } = require("zod");

const firmas = {
  "image/jpeg": (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
  "image/gif": (b) => /^GIF8[79]a$/.test(b.toString("ascii", 0, 6)),
  "image/webp": (b) => b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
};

const imagenArchivo = z.string().max(2_800_000).transform((valor, ctx) => {
  const match = /^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(valor);
  if (match) {
    const [, mime, contenido] = match;
    const datos = Buffer.from(contenido, "base64");
    if (datos.length <= 2_097_152 && datos.toString("base64") === contenido && firmas[mime](datos)) {
      return { mime, datos };
    }
  }
  ctx.addIssue({ code: "custom", message: "Usa una imagen JPG, PNG, WebP o GIF de hasta 2 MB" });
  return z.NEVER;
});

const imagenUrl = z.string().trim().max(2048).url().refine((valor) => {
  try {
    const url = new URL(valor);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}, "Ingresa un enlace HTTPS directo a la imagen");

module.exports = { imagenArchivo, imagenUrl };
