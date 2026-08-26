# Análisis y Mapeo Estructurado de Información Clínica (Lote 3 — 10 Productos)

Este documento organiza la información extraída de las fichas técnicas (`real-products/`) y los catálogos clínicos (`catalogs/indices/`) para los **10 productos del lote 3**, en el mismo formato que `docs/analisis_informacion_clinica_10_productos.md`.

Es un documento de **revisión previa a la carga**: nada de esto está en la base de datos todavía. El JSON estructurado equivalente a cada sección está en `tmp/migration/extracted/*.json`, que es lo que `pnpm db:ingest` va a leer una vez que la doctora apruebe.

---

## 📐 Esquema de Mapeo en Payload CMS

Toda la información se canaliza estrictamente a través de las siguientes estructuras del modelo:

1. **Protocolo de Aplicación (`Protocols.ts` / Colección `protocols`)**:
   - `visibleEffectsOnset`: Inicio de efectos visibles.
   - `effectDuration`: Duración del efecto.
   - `recommendedDose`: Dosis recomendada y calibre de aguja (si aplica).
   - `injectionDepth`: Profundidad / plano de aplicación.
   - `sessionsMin` / `sessionsMax`: Número de sesiones mínimas y máximas.
   - `frequency`: Frecuencia de aplicación.

2. **Presentación Comercial (`Products.ts` -> array `presentations`)**:
   - **`reconstitution` (Grupo Reconstitución / Dilución)**: Procedimiento exclusivo para productos que requieren preparación (liofilizados: HYALURONIDASE, LIPASE).
   - `certifications`: Certificaciones / Registros sanitarios (ninguno declarado en este lote).

3. **Grupo de Seguridad Clínica (Colecciones Relacionales)**:
   - **Indicaciones Clínicas** (`clinical-indications`).
   - **Contraindicaciones** (`contraindications`) — `absoluta` o `relativa`.
   - **Efectos Adversos** (`adverse-effects`).
   - **Cuidados Post-Aplicación** (`post-care-notes`).
   - **Advertencias de Seguridad** (`safety-warnings`).

### Alertas transversales de este lote (para revisión prioritaria)

- **Laboratorio sin dato en 3 de los 10 productos**: `HILOS PDO`, `LIDOCAINA` y `LIPO LAB` no declaran laboratorio ni país de origen en ninguna de las dos fuentes. El campo quedó vacío en el JSON en vez de inventarse (`"Laboratorio MCCM, España"` por analogía habría sido un dato inventado). Hay que completarlo a mano antes de aprobar.
- **`HYALURONIDASE LIQUID`** no tiene catálogo clínico que la cubra (ni `hidratantes.md`, donde está clasificada en `registry.json`, ni `enzimas.md`, que es la familia a la que pertenece por composición). Solo trae los datos de su propia ficha; sin cuidados posteriores ni protocolo de zonas/dosis.
- **`LAURETH`** es un esclerosante intravenoso (escleroterapia de varices), no una mesoterapia intradérmica como el resto de la familia "Mesoterapia Regenerativa (MCCM)" a la que pertenece su catálogo. Por eso NO recibió las contraindicaciones/efectos/cuidados compartidos de esa familia — el propio catálogo advierte que no está claro si aplican a un producto IV. Revisar si corresponde agregar contraindicaciones propias de escleroterapia (trombosis, necrosis).
- **`LIPO LAB`** trae una contraindicación nueva, **`Epilepsia`**, sin tipo asignado porque la ficha no permite decidir si es absoluta o relativa: el cargador la creará como absoluta y debe confirmarse.
- Varios términos de vocabulario que el lote 2 había creado como nuevos (`Celulitis`, `Piel cansada`, `Acción antioxidante`, `Uso estricto de protector solar`, `Lipólisis`) **ya no están** en `tmp/migration/vocabulary.json` regenerado ahora, lo que indica que se fusionaron con otros términos en el admin local. Donde este lote necesitó el mismo concepto, se volvió a proponer el término granular (siguiendo la regla mecánica "si no está en el vocabulario actual, se propone"), señalado caso por caso más abajo. Vale la pena una pasada de curación conjunta.

---

## 📦 Desglose Clínico por Producto

### 1. HILOS PDO (Laboratorio sin dato)
* **Categoría:** Hilos Tensores de Polidioxanona (PDO) | 3 tipos — MONO, TORNADO, COG Bidireccional 6D — en 12 medidas de calibre/longitud
* **Ingredientes Activos:** Polidioxanona (PDO)

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo — MONO** (7 presentaciones) | `zones`<br>`routes`<br>`visibleEffectsOnset`<br>`effectDuration` | • **Zonas:** Facial, Corporal.<br>• **Vía:** Intradérmica.<br>• **Inicio de efecto:** 1 a 3 meses.<br>• **Duración:** el hilo se degrada en 6 a 8 meses (se elimina por la orina); sus efectos permanecen ~1 año. |
| **Protocolo — TORNADO** (2 presentaciones) | `zones` | • **Zonas:** Facial, Cuello, Escote. Sin datos de inicio/duración de efecto en ninguna fuente. |
| **Protocolo — COG Bidireccional 6D** (3 presentaciones) | `zones`<br>`injectionDepth`<br>`visibleEffectsOnset` | • **Zonas:** Facial, Corporal, Nasogenianos, Rinomodelación, Marcaje mandibular, Líneas de marioneta, Mejillas.<br>• **Profundidad:** Subdérmico.<br>• **Inicio de efecto:** inmediato (mecánico) desde la aplicación; colagenización tardía progresiva. |
| **Presentación** | `reconstitution` | • No aplica: son hilos, no requieren reconstitución. |
| **Seguridad Clínica** | `clinical-indications` | • Efecto tensor, firmeza cutánea y lifting facial.<br>• Estimulación de la producción de colágeno.<br>• Flacidez.<br>• Atenuación de líneas de expresión y arrugas finas.<br>• Elasticidad cutánea. |
| **Seguridad Clínica** | `contraindications` | **Absolutas:** Heridas/úlceras/lesiones infectadas o dermatosis supurante; Hipersensibilidad a algún componente; Embarazo y lactancia; Infección bacteriana activa; Infecciones virales activas (herpes); Insuficiencia renal o hepática; Enfermedad colágena descontrolada; Cicatrización queloide; Procesos inflamatorios agudos.<br>**Relativas:** Enfermedades crónico-degenerativas en descontrol; Estados de inmunosupresión o enfermedades autoinmunes activas; Tratamiento odontológico próximo; Trastornos de la coagulación o tratamiento con anticoagulantes; Estados depresivos o patología mental. |
| **Seguridad Clínica** | `adverse-effects` | • Eritema/Enrojecimiento local transitorio.<br>• Hematoma/Equimosis.<br>• Dolor leve en el sitio de punción.<br>• Dolor leve a moderado por tracción y manipulación (hilos espiculados). |
| **Seguridad Clínica** | `post-care-notes` | Organizados por plazo: **24 h** — evitar maquillaje/manipulación, evitar alcohol y tabaco, no hielo ni desinflamatorios, paracetamol 500 mg/8h si dolor, árnica/rosa mosqueta si hematomas. **48 h** — evitar sauna/jacuzzi/alberca. **1 semana** — evitar desinflamatorios, dormir con almohada de viaje/cojín de cuello. **2 semanas** — evitar tratamientos odontológicos, evitar apertura excesiva de la boca (espiculados). **3-4 semanas** — evitar ejercicios de fuerza, masajes y faciales. |
| **Seguridad Clínica** | `safety-warnings` | • Uso exclusivo por profesional sanitario / médico capacitado. |

---

### 2. HYALURONIC ACID (Laboratorio MCCM, España)
* **Categoría:** Mesoterapia Hidratante | Vial de 5 ml
* **Ingredientes Activos:** Ácido Hialurónico No Reticulado 20 mg/ml (2%)

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `routes`<br>`techniques`<br>`recommendedDose`<br>`sessionsMin`/`Max`<br>`frequency` | • **Vía:** Intradérmica.<br>• **Técnica:** Mesoterapia, Dermapen.<br>• **Dosis:** 0.01-0.03 ml por punción.<br>• **Sesiones:** 3, 1 vez por semana. |
| **Presentación** | `reconstitution` | • No requiere reconstitución: solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Hidratación profunda cutánea.<br>• Luminosidad cutánea.<br>• Mejora de la textura cutánea.<br>• Estimulación de la producción de colágeno.<br>• Atenuación de líneas de expresión y arrugas finas.<br>• Elasticidad cutánea.<br>• Prevención del envejecimiento cutáneo. |
| **Seguridad Clínica** | `contraindications` | • Infección o inflamación activa en el sitio de inyección (absoluta).<br>• Hipersensibilidad a algún componente (absoluta).<br>• Enfermedades crónico-degenerativas en descontrol (relativa).<br>• Embarazo y lactancia (absoluta).<br>*(A diferencia del resto del lote, esta ficha NO menciona "pacientes hipertensos".)* |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve en el sitio de punción.<br>• Eritema/Enrojecimiento local transitorio.<br>• Prurito (picazón) leve. |
| **Seguridad Clínica** | `post-care-notes` | • Evitar tocar/manipular/masajear el rostro.<br>• Evitar sudoración excesiva, agua de mar y piscina.<br>• Limpiar la piel y aplicar tónicos tras 4 horas.<br>• Mantener buena hidratación cutánea.<br>• Protección solar estricta FPS 50+ y evitar exposición prolongada al sol. |

---

### 3. HYALURONIDASE LIQUID (Laboratorio MCCM, España)
* **Categoría:** Mesoterapia Lipolítica (sin catálogo clínico propio — ver alerta arriba) | Ampolleta de 5 ml
* **Ingredientes Activos:** Hialuronidasa

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | — | • Sin datos: la ficha no trae zonas, vía, técnica, dosis ni frecuencia, y no hay catálogo aplicable. El protocolo se creará solo con nombre ("Protocolo Lipolítico y Drenante HYALURONIDASE LIQUID"). |
| **Presentación** | `reconstitution` | • No requiere reconstitución: solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Tratamiento integral de celulitis (Adiposa, Edematosa y Dura/Fibrosa) (ID 13).<br>• Reducción de grasa localizada.<br>• Efecto drenante y reducción de retención de líquidos (Edema). |
| **Seguridad Clínica** | `contraindications` | • Heridas/úlceras/lesiones infectadas o dermatosis supurante (absoluta).<br>• Hipersensibilidad a algún componente (absoluta).<br>• Pacientes hipertensos (relativa).<br>• Enfermedades crónico-degenerativas en descontrol (relativa).<br>• Embarazo y lactancia (absoluta). |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve en el sitio de punción.<br>• Eritema/Enrojecimiento local transitorio.<br>• Prurito (picazón) leve. |
| **Seguridad Clínica** | `post-care-notes` | • Ninguno: la ficha no declara cuidados posteriores y no hay catálogo que los aporte. |

---

### 4. HYALURONIDASE (Laboratorio MCCM, España)
* **Categoría:** Enzimas (Mesoterapia) | Vial liofilizado 1500 UI
* **Ingredientes Activos:** Hialuronidasa 1500 UI

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo — Facial** | `zones`<br>`techniques`<br>`recommendedDose`<br>`injectionDepth`<br>`sessionsMin`/`Max`<br>`frequency` | • **Zona:** Facial. **Técnica:** Mesoterapia.<br>• **Dosis:** volumen total 5 ml; 0.1-0.3 ml por punción, separación 1-1.5 cm.<br>• **Profundidad:** 6-8 mm (ojeras 2-4 mm).<br>• **Sesiones:** 3 a 5, 1 por semana (dato propio de la ficha, no el genérico 4-6 del catálogo). |
| **Protocolo — Corporal** | ídem | • **Zona:** Corporal. **Técnica:** Mesoterapia Corporal.<br>• **Dosis:** volumen total 10 ml (máx. 20 ml/2 viales); 0.1-0.5 ml por punción.<br>• **Profundidad:** 8-12 mm.<br>• **Sesiones:** 3 a 5, cada 2 semanas. |
| **Presentación** | `reconstitution` | • **Diluyente:** Solución salina. **Volumen:** 10 ml (dato del catálogo; la ficha no trae instrucciones de dilución propias). |
| **Seguridad Clínica** | `clinical-indications` | • Efecto drenante y reducción de retención de líquidos (Edema).<br>• Reducción de grasa localizada.<br>• Disolución de rellenos dérmicos a base de ácido hialurónico (término nuevo). |
| **Seguridad Clínica** | `contraindications` | **Absolutas:** Infección o inflamación activa en el sitio de inyección; Hipersensibilidad a algún componente; Embarazo y lactancia.<br>**Relativas:** Enfermedades crónico-degenerativas en descontrol; Estados de inmunosupresión o enfermedades autoinmunes activas; Trastornos de la coagulación o tratamiento con anticoagulantes. *(Todas salen del catálogo — la ficha no tiene sección propia de contraindicaciones.)* |
| **Seguridad Clínica** | `adverse-effects` | • Hematoma/Equimosis.<br>• Ardor temporal en la zona de aplicación.<br>• Dolor leve en el sitio de punción.<br>• Prurito (picazón) leve.<br>• Edema/Inflamación o hinchazón local. *(Todos del catálogo; la ficha no tiene REACCIONES propia. Sin "eritema/enrojecimiento": el catálogo no lo lista para este producto.)* |
| **Seguridad Clínica** | `post-care-notes` | • Hidratación abundante.<br>• No alcohol 48 h.<br>• No ejercicio 24 h.<br>• Esperar 72 h para radiofrecuencia/aparatología.<br>• Paracetamol si febrícula.<br>• Evitar carbohidratos 5 días.<br>• Barbicuello (opcional) *(duda abierta, ver reporte_dudas.md)*.<br>• Fitoterapia MCCM *(duda abierta)*. |

---

### 5. L CARNITINE (Laboratorio MCCM, España)
* **Categoría:** Mesoterapia Lipolítica | Ampolleta de 5 ml
* **Ingredientes Activos:** L-Carnitina

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `routes`<br>`techniques`<br>`recommendedDose`<br>`sessionsMin`/`Max`<br>`frequency` | • **Vía:** Subcutánea, Tejido Adiposo. **Técnica:** Mesoterapia.<br>• **Dosis:** 0.01-0.03 ml por punción (el catálogo trae un error de tipeo "1.01-0.03 ml"; se cargó el rango corregido).<br>• **Sesiones:** 4 a 6, cada 2 semanas. |
| **Presentación** | `reconstitution` | • No requiere reconstitución: solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Reducción de grasa localizada (ID 12).<br>• Estimulación del metabolismo lipídico y permeabilidad adipocitaria. |
| **Seguridad Clínica** | `contraindications` | • Heridas/úlceras/lesiones infectadas o dermatosis supurante (absoluta).<br>• Hipersensibilidad a algún componente (absoluta).<br>• Pacientes hipertensos (relativa).<br>• Enfermedades crónico-degenerativas en descontrol (relativa).<br>• Embarazo y lactancia (absoluta). |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, Eritema/Enrojecimiento, Prurito leve (ficha) + Hematoma, Ardor temporal, Edema/Inflamación (catálogo). |
| **Seguridad Clínica** | `post-care-notes` | • Hidratación abundante.<br>• Evitar carbohidratos 5 días.<br>• Evitar ejercicio 24 h.<br>• Esperar 72 h para RF/aparatología.<br>• Paracetamol si febrícula. |
| **Seguridad Clínica** | `safety-warnings` | • Respetar la dosificación y el intervalo mínimo entre sesiones (evitar necrosis o reacciones adversas). |

---

### 6. LAURETH (Laboratorio MCCM, España)
* **Categoría:** Escleroterapia (agente esclerosante, vía intravenosa — NO mesoterapia intradérmica) | Ampolleta de 2 ml
* **Ingredientes Activos:** Laureth-9

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `routes`<br>`techniques`<br>`recommendedDose`<br>`effectDuration` | • **Vía:** Intravenosa (término nuevo). **Técnica:** Escleroterapia (término nuevo).<br>• **Dosis:** hasta 6 ml por sesión (3 ampolletas), infiltrando en la vena hasta que se "borre"; si quedan venas visibles, reprogramar sesión.<br>• **Duración del efecto:** ~6 a 8 meses. |
| **Presentación** | `reconstitution` | • No aplica. |
| **Seguridad Clínica** | `clinical-indications` | • Varices, Rosácea, Cuperosis, Venas finas (los cuatro términos nuevos). |
| **Seguridad Clínica** | `contraindications` | • Heridas/úlceras/lesiones infectadas o dermatosis supurante (absoluta).<br>• Hipersensibilidad a algún componente (absoluta).<br>• Pacientes hipertensos (relativa).<br>• Enfermedades crónico-degenerativas en descontrol (relativa).<br>• Embarazo y lactancia (absoluta).<br>*(Deliberadamente NO se agregaron las contraindicaciones compartidas de la familia "Mesoterapia Regenerativa" — ver alerta arriba.)* |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve en el sitio de punción.<br>• Eritema/Enrojecimiento local transitorio.<br>• Prurito (picazón) leve. |
| **Seguridad Clínica** | `post-care-notes` | • Ninguno declarado (ver alerta sobre exclusión de la sección compartida del catálogo). |

---

### 7. LIDOCAINA — "MI-CAINE" (Laboratorio sin dato)
* **Categoría:** Anestésico Tópico | Crema de 30 g
* **Ingredientes Activos:** Lidocaína 10.56%

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `routes`<br>`visibleEffectsOnset`<br>`effectDuration` | • **Vía:** Tópica (término nuevo).<br>• **Inicio:** dejar actuar al menos 15 minutos antes del procedimiento.<br>• **Duración del efecto:** 40 a 45 minutos. |
| **Presentación** | `reconstitution` | • No aplica: crema tópica lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Anestesia tópica previa a procedimientos (término nuevo). |
| **Seguridad Clínica** | `contraindications` | • Hipersensibilidad / alergia a algún componente de la fórmula (ID 13, absoluta).<br>• Embarazo y lactancia (absoluta). |
| **Seguridad Clínica** | `adverse-effects` | • Eritema/Enrojecimiento local transitorio.<br>• Edema/Inflamación o hinchazón local.<br>• Prurito (picazón) leve.<br>• Palidez (nuevo).<br>• Alteraciones sensoriales en la percepción de temperatura (nuevo).<br>• Rash cutáneo (nuevo). |
| **Seguridad Clínica** | `post-care-notes` | • Ninguno declarado en ninguna fuente. |

---

### 8. LIPASE (Laboratorio MCCM, España)
* **Categoría:** Enzimas (Mesoterapia) | Vial liofilizado 1500 UI
* **Ingredientes Activos:** Lipasa 1500 UI

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo — Facial** | igual estructura que HYALURONIDASE | • **Zona:** Facial. **Dosis:** volumen total 5 ml; 0.1-0.3 ml por punción. **Profundidad:** 6-8 mm (ojeras 2-4mm). **Sesiones:** 3 a 5, 1 por semana (dato propio de la ficha). |
| **Protocolo — Corporal** | ídem | • **Zona:** Corporal. **Dosis:** volumen total 10 ml (máx. 20 ml). **Profundidad:** 8-12 mm. **Sesiones:** 3 a 5, cada 2 semanas. |
| **Presentación** | `reconstitution` | • **Diluyente:** Solución fisiológica 0.9%. **Volumen:** 10 ml (dato propio de la ficha). |
| **Seguridad Clínica** | `clinical-indications` | • Reducción de grasa localizada. |
| **Seguridad Clínica** | `contraindications` | **Absolutas:** Infección o inflamación activa en el sitio de inyección; Embarazo y lactancia; Hipersensibilidad a algún componente.<br>**Relativas:** Enfermedades crónico-degenerativas en descontrol; Estados de inmunosupresión o enfermedades autoinmunes activas; Trastornos de la coagulación o tratamiento con anticoagulantes (las dos últimas del catálogo). |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, Eritema/Enrojecimiento, Prurito leve, Hematoma, Febrícula (ficha) + Ardor temporal, Edema/Inflamación (catálogo). |
| **Seguridad Clínica** | `post-care-notes` | • Hidratación abundante y Esperar 72h para RF (ficha, cuidados reales pese al título "RECOMENDACIONES") + No alcohol 48h, No ejercicio 24h, Paracetamol si febrícula, Evitar carbohidratos 5 días, Barbicuello (opcional), Fitoterapia MCCM (catálogo). |

---

### 9. LIPO FIRMING (Laboratorio MCCM, España)
* **Categoría:** Mesoterapia Lipolítica / Reafirmante | Vial de 10 ml
* **Ingredientes Activos:** DMAE, Pantenol, Ácido pirúvico, Centella Asiática, L-Carnitina, Alantoína, Laureth-3

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `routes`<br>`techniques`<br>`recommendedDose`<br>`sessionsMin`/`Max`<br>`frequency` | • **Vía:** Subcutánea, Tejido Adiposo. **Técnica:** Mesoterapia.<br>• **Dosis:** 0.01-0.03 ml por punción (rango corregido del catálogo).<br>• **Sesiones:** 4 a 6, cada 2 semanas. |
| **Presentación** | `reconstitution` | • No requiere reconstitución: solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Estimulación de la producción de colágeno.<br>• Acción antioxidante y fotoprotección (Prevención de daño solar) (ID 5).<br>• Flacidez.<br>• Reducción de grasa localizada (estas dos últimas del catálogo, no de la ficha). |
| **Seguridad Clínica** | `contraindications` | • Heridas/úlceras/lesiones infectadas o dermatosis supurante (absoluta).<br>• Hipersensibilidad a algún componente (absoluta).<br>• Pacientes hipertensos (relativa).<br>• Enfermedades crónico-degenerativas en descontrol (relativa).<br>• Embarazo y lactancia (absoluta). |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, Eritema/Enrojecimiento, Prurito leve (ficha) + Hematoma, Ardor temporal, Edema/Inflamación (catálogo). |
| **Seguridad Clínica** | `post-care-notes` | • Hidratación abundante, Evitar carbohidratos 5 días, Evitar ejercicio 24h, Esperar 72h RF, Paracetamol si febrícula (todo del catálogo). |
| **Seguridad Clínica** | `safety-warnings` | • Respetar la dosificación y el intervalo mínimo entre sesiones. |

---

### 10. LIPO LAB (Laboratorio sin dato)
* **Categoría:** Lipolítico de otra marca | Vial
* **Ingredientes Activos:** Fosfatidilcolina, Tetrapéptido-7, Desoxicolato de sodio, Acetil hexapéptido-8, L-Carnitina, Pentapéptido-4

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `zones`<br>`routes`<br>`recommendedDose`<br>`sessionsMin`/`Max`<br>`frequency` | • **Zonas:** Abdomen, Cintura (dosis plena); Papada, Axila, Brazos, Muslo (dosis reducida — tres zonas nuevas de vocabulario: Cintura, Axila, Muslo).<br>• **Vía:** Tejido Adiposo.<br>• **Dosis:** 0.2-0.4 cc por punto, separación ~1 cm; 1-2 viales según obesidad.<br>• **Sesiones:** 2 a 3, cada 15 días. |
| **Presentación** | `reconstitution` | • No aplica (no es liofilizado); requiere agitación previa (ver advertencia). |
| **Seguridad Clínica** | `clinical-indications` | • Reducción de grasa localizada.<br>• Tratamiento integral de celulitis (Adiposa, Edematosa y Dura/Fibrosa) (ID 13).<br>• Fibrosis. |
| **Seguridad Clínica** | `contraindications` | **Absolutas:** Hipersensibilidad a algún componente; Alergia a la soja (nuevo); Embarazo y lactancia; Infección o inflamación activa en el sitio de inyección.<br>**Relativas:** Enfermedades crónico-degenerativas en descontrol; Estados de inmunosupresión o enfermedades autoinmunes activas.<br>**Sin tipo asignado:** Epilepsia (nuevo — la ficha no permite decidir el tipo; el cargador la creará como absoluta y debe confirmarse). |
| **Seguridad Clínica** | `adverse-effects` | • Edema/Inflamación o hinchazón local.<br>• Eritema/Enrojecimiento local transitorio.<br>• Efectos adversos sistémicos de tipo colinérgico (náuseas, vómitos, diarrea, sudoración profusa, alteración de la salivación y el gusto), leves (término nuevo compuesto).<br>• Arritmias cardíacas (término nuevo, solo del catálogo — ver duda en reporte_dudas.md). |
| **Seguridad Clínica** | `post-care-notes` | • Evitar la fricción del área tratada.<br>• No consumir bebidas alcohólicas por 48 horas (ID 14).<br>• Abstenerse de alimentos ricos en grasas.<br>• Hidratación abundante.<br>• Evitar ropa ajustada tras el tratamiento (riesgo de ampollas; sensibilidad hasta 1 semana). |
| **Seguridad Clínica** | `safety-warnings` | • Agitar bien el vial antes de usar.<br>• El catálogo advierte que la solución de fosfatidilcolina podría disolver músculo y nervio si no se respeta la técnica subcutánea correcta. |

---

## 🎯 Resumen de Arquitectura y Reglas de Carga

1. **Protocolo de Aplicación (`protocols`)**: dueño único de inicio/duración de efecto, dosis, sesiones y frecuencia. En este lote, `HILOS PDO` reparte tres protocolos distintos (MONO/TORNADO/COG) entre sus 12 presentaciones, y `HYALURONIDASE`/`LIPASE` repiten el patrón facial/corporal de `CLH LIPASE 1500`/`COLLAGENASE 1500 UI` del lote 2.
2. **Presentación Comercial (`presentations.reconstitution`)**: solo aplica a los dos liofilizados del lote, `HYALURONIDASE` y `LIPASE`.
3. **Colecciones Relacionales (`Seguridad Clínica`)**: `HYALURONIDASE LIQUID` y `LAURETH` son las dos excepciones del lote que NO reciben las secciones compartidas de su catálogo de familia (la primera por no tener catálogo que la cubra; la segunda porque el propio catálogo advierte que no aplican a su vía intravenosa). Todo lo demás sigue el patrón de "ficha + secciones `Aplica a:` del catálogo" ya usado en el lote 2.
4. **Vocabulario nuevo propuesto en este lote** (por si la doctora quiere revisarlo de una sola vez): Polidioxanona (PDO); Mejillas, Cintura, Axila, Muslo (zonas); Intravenosa, Tópica (vías); Escleroterapia (técnica); Varices, Rosácea, Cuperosis, Venas finas, Anestesia tópica previa a procedimientos, Disolución de rellenos dérmicos a base de ácido hialurónico (indicaciones); Tratamiento odontológico próximo, Infección bacteriana activa, Infecciones virales activas (herpes), Insuficiencia renal o hepática, Enfermedad colágena descontrolada, Cicatrización queloide, Procesos inflamatorios agudos, Estados depresivos o patología mental, Alergia a la soja, Epilepsia (contraindicaciones); Dolor leve a moderado por tracción y manipulación, Palidez, Alteraciones sensoriales en la percepción de temperatura, Rash cutáneo, Efectos adversos sistémicos de tipo colinérgico (…), Arritmias cardíacas (efectos adversos); 11 cuidados post-aplicación de `Hilos PDO.md` por plazo, más los propios de `LIPO LAB`; Uso exclusivo por profesional… (reutilizado), Agitar el vial…, advertencia sobre disolución de músculo/nervio (advertencias).
