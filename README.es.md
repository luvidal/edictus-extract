# @edictus/extract

[English](README.md) · **Español**

Extractor de campos para documentos chilenos basado en el prompt:
liquidaciones de sueldo, carpetas tributarias, informes de deuda CMF, cartolas
bancarias y más. Con el archivo y su tipo de documento, una sola llamada a
Gemini devuelve los campos con su tipo.

Es el segundo paso después del clasificador de
[`edictus-document-ai`](https://github.com/luvidal/edictus-document-ai): el
clasificador decide *qué* es un archivo y este paquete lo lee.

## Lo destacado

- **Una llamada al modelo por documento.** El código local hace el resto:
  - lee JSON de forma tolerante y recupera respuestas truncadas;
  - convierte cada campo a su tipo (número, fecha, mes, hora, booleano, lista,
    objeto).

  Son unas 350 líneas más el prompt.
- **Sin `responseSchema`, a propósito.** La salida estructurada de Vertex AI
  descarta en silencio las claves anidadas que no se declaran de antemano, y la
  forma de las filas cambia entre documentos.
- **Ejemplos por configuración.** Hasta 3 salidas de referencia por tipo de
  documento orientan el formato sin tocar código.
- **Diccionario de liquidaciones** (`@edictus/extract/liquidacion`). Un
  comparador determinista lleva las glosas de la liquidación a ítems
  canónicos:
  - unifica variantes de tildes, mayúsculas y puntuación (`Asignacion Colacion` → `Colación`);
  - los haberes solo se resuelven como haberes y los descuentos solo como descuentos;
  - cuando dos líneas reclaman el mismo ítem en el mismo mes, una gana y la
    otra queda sin asignar.

  La fuente de verdad es un YAML editado a mano que se compila al construir el
  paquete.
- **La aplicación inyecta la IA.** No hay SDK en tiempo de ejecución: la
  aplicación entrega un `geminiCall` ya autenticado y se encarga de las claves,
  las cuotas y los reintentos.
- **95 tests** (Vitest, con Gemini simulado). Arneses manuales de corpus y de
  *ground truth* corren contra documentos reales que no se suben al repo.

## Instalación

```bash
npm i github:luvidal/edictus-extract#<sha-del-commit>
```

## Uso

```ts
import { GoogleGenAI } from '@google/genai'
import { configure, extract } from '@edictus/extract'
import doctypes from './doctypes.json'

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
// Para Vertex AI: new GoogleGenAI({ vertexai: true, project, location })

configure({
  doctypes,
  geminiCall: ({ model, contents, config }) => ai.models.generateContent({ model, contents, config }),
})

const result = await extract(pdfBuffer, 'application/pdf', 'liquidaciones-sueldo')
// → { doctype, fields: [{ key: 'empleador', type: 'string', value: 'Acme SpA' }, …], docdate: '2024-06-30', usage }
```

El catálogo de tipos de documento está en
[`edictus-document-ai/packages/doctypes`](https://github.com/luvidal/edictus-document-ai/tree/main/packages/doctypes).

## API

```ts
extract(buffer: Buffer, mimetype: string, doctype: string, opts?: ExtractOptions): Promise<ExtractResult>
extractFields(buffer: Buffer, mimetype: string, doctype: string, opts?: ExtractOptions): Promise<ExtractedField[]>
```

- **`buffer` y `mimetype`**: bytes de un PDF o una imagen. Acepta
  `application/pdf` e `image/jpeg`, `png`, `webp`, `heic` y `heif`.
- **`doctype`**: un id del catálogo configurado.
- **`opts.model`**: por defecto `gemini-2.5-pro`.
- **`opts.generationConfig`**: ajustes opcionales de Gemini (`temperature`,
  `topP`, `seed`, `thinkingConfig`, …).
- **`opts.references`**: ejemplos de referencia para esa llamada.

Cada `ExtractedField` es `{ key, type, value }`, y los valores ausentes son
`null`. `ExtractResult` agrega `docdate` (`YYYY-MM-DD` o `null`) y `usage`
(conteo de tokens).

### Ejemplos de referencia

```ts
configure({
  doctypes,
  geminiCall,
  references: {
    'liquidaciones-sueldo': [
      { empleador: 'Acme SpA', rut: '12.345.678-9', periodo: '2024-06', haberes: [{ label: 'Sueldo Base', value: 800000 }] },
    ],
  },
})
```

Las referencias se toman en este orden hasta completar 3: primero las de
`configure`, luego los `examples` del propio catálogo y al final las de
`opts.references` de cada llamada.

## Elección del modelo y problemas conocidos

- **Modelo.** Gemini Pro es la base de exactitud para PDF escaneados y
  liquidaciones con muchas tablas. Modelos más livianos perdieron filas de
  sueldo en pruebas en producción, así que solo se usan para análisis
  auxiliares de bajo riesgo.
- **Formato de fechas.** A veces el modelo devuelve `DD/MM/YYYY` en algunos
  campos de fecha, pese a la regla del prompt.
- **Liquidaciones cortas.** A veces pierden su última fila de descuentos. Pasa
  de forma estable entre ejecuciones con `temperature: 0`.

El registro de evaluación está en
[`docs/extractor-testing-notes.md`](docs/extractor-testing-notes.md) (en
inglés).

## Desarrollo

```bash
npm test             # Vitest, con Gemini simulado
npm run build        # compila el diccionario y luego tsup → dist/
npm run playground   # zona local para soltar archivos en el navegador (requiere credenciales de Gemini)
npm run corpus       # ejecución manual sobre un corpus local
npm run groundtruth  # comparación manual contra salidas revisadas
```
