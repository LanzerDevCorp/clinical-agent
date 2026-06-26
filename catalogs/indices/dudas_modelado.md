# Dudas Pendientes de Modelado (Glosario y Relaciones)

Este archivo registra las dudas sobre relaciones y estructuras de datos pendientes de definición para el modelo clínico y técnico en Payload CMS.

---

## 1. Relaciones de la Entidad: Combinación Efectiva (Cócteles)

- **Descripción**: En las guías técnicas de enzimas y otros productos, se describen combinaciones sinérgicas de múltiples productos (ej. "Colagenasa 1500 UI + CLH Lipasa 1500 UI" para "Alta adiposidad y flacidez").
- **Dudas a Resolver**:
  - ¿Debe modelarse como una relación de muchos a muchos directa entre `Presentación Comercial` y una entidad intermedia `Combinación Efectiva`?
  - ¿Cómo se asociarán las dosis y proporciones específicas a cada producto dentro de la combinación?
  - ¿Debe la `Indicación Clínica` ser una relación de uno a muchos o de muchos a muchos desde la combinación?

---

## 2. Régimen de Tratamiento sin Protocolo de Aplicación

- **Descripción**: Se decidió modelar el Régimen de Tratamiento como campos dentro de `protocolo_aplicacion` (frecuencia, num_sesiones_min, num_sesiones_max, intervalo). La duda es si esta asunción cubre todos los casos.
- **Dudas a Resolver**:
  - ¿Existe algún producto que tenga Régimen de Tratamiento definido pero NO tenga Protocolo de Aplicación asociado? (ej. dispositivos médicos, insumos de aplicación u otros tipos que podrían tener un régimen de uso sin un protocolo clínico formal)
  - Si existe, ¿el Régimen de Tratamiento necesita ser una entidad separada con FK opcional a `protocolo_aplicacion`, o siempre va acompañado de un protocolo?

---

## 3. Agrupación vs Separación de Fichas Técnicas

- **Descripción**: Decisión de arquitectura de datos sobre cómo modelar las líneas de productos con múltiples variantes (ej: la familia *Celosome* con *Soft*, *Mid*, *Strong*, *Implant*, o los rellenos *Sofiderm* de 1ml y 2ml).
- **Recomendación**: El criterio diferenciador debería ser el **perfil clínico**:
  - Si solo cambia el packaging/volumen → mismo `Producto`, distinta `Presentación Comercial` (ej. Sofiderm 1ml y 2ml).
  - Si cambia el perfil clínico — indicaciones distintas, protocolos distintos, zonas de aplicación distintas → `Producto` separado dentro de la familia (ej. Celosome Soft vs Celosome Implant serían cuatro registros `Producto` independientes).
- **Dudas a Resolver (para consultar con la Dra.)**:
  - ¿El criterio de perfil clínico refleja cómo los profesionales consultan y diferencian estos productos en la práctica?
  - ¿Existe información clínica (contraindicaciones, laboratorio) idéntica para toda la familia que justifique una relación `producto_padre` para no duplicarla?
  - ¿Cuáles son las implicaciones clínicas si un profesional busca específicamente la variante *Implant* y la información de contraindicaciones estuviera heredada/agrupada a nivel general en lugar de ser totalmente explícita en su propio registro?

