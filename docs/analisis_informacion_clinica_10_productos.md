# Análisis y Mapeo Estructurado de Información Clínica (10 Productos)

Este documento organiza minuciosamente la información extraída de los catálogos y fichas técnicas de los **10 productos activos en Payload CMS**.

El objetivo de esta clasificación es **encajar correctamente cada dato en el modelo relacional existente de Payload**, evitando la dispersión de datos o la creación innecesaria de campos adicionales.

---

## 📐 Esquema de Mapeo en Payload CMS

Toda la información se canaliza estrictamente a través de las siguientes estructuras del modelo:

1. **Protocolo de Aplicación (`Protocols.ts` / Colección `protocols`)**:
   - `visibleEffectsOnset`: Inicio de efectos visibles (ej: "5 a 7 días", "Progresivo desde la primera sesión").
   - `effectDuration`: Duración del efecto (ej: "4 a 6 meses", "Hasta 6 meses").
   - `recommendedDose`: Dosis recomendada y calibre de aguja (ej: "2-4 UI. Aguja 30G x 6mm").
   - `injectionDepth`: Profundidad de inyección (ej: "Intradérmica", "Intramuscular", "Subcutánea").
   - `sessionsMin` / `sessionsMax`: Número de sesiones mínimas y máximas.
   - `frequency`: Frecuencia de aplicación (ej: "Cada 2 a 4 semanas", "Cada 4 a 6 meses").

2. **Presentación Comercial (`Products.ts` -> array `presentations`)**:
   - **`reconstitution` (Grupo Reconstitución / Dilución)**: Procedimiento exclusivo para productos que requieran preparación (ej. liofilizados como `BELLATOXEL`, `BOTULAX`, `BTSA9`):
     * `diluentType`: Tipo de diluyente (ej: "Solución salina estéril al 0.9%").
     * `volumeMl`: Volumen en mL (ej: `1`).
     * `instructions`: Instrucciones detalladas de preparación (ej: "Reconstituir lentamente con 1 mL refrigerado...").
   - `certifications`: Certificaciones / Registros sanitarios a nivel Presentación Comercial (`presentations.certifications`, ej: "KFDA Corea del Sur").

3. **Grupo de Seguridad Clínica (Colecciones Relacionales)**:
   - **Indicaciones Clínicas** (`clinical-indications`): Usos, acciones terapéuticas y propósitos del tratamiento.
   - **Contraindicaciones** (`contraindications`): Condición o patología que prohíbe o restringe el uso (`absoluta` o `relativa`).
   - **Efectos Adversos** (`adverse-effects`): Reacciones secundarias esperadas o no deseadas (`leve`, `moderada`, `severa`).
   - **Cuidados Post-Aplicación** (`post-care-notes`): Recomendaciones y restricciones directas para el paciente tras el procedimiento.
   - **Advertencias de Seguridad** (`safety-warnings`): Precauciones técnicas, conservación, interacciones medicamentosas o requisitos de uso médico especializado.

---

## 📦 Desglose Clínico por Producto

### 1. AEC (MCCM, España)
* **Categoría:** Mesoterapia Regenerativa | Ampolleta de 5 ml
* **Ingredientes Activos:** Vitamina A (Retinol), Vitamina E (Tocopherol), Vitamina C (Ácido Ascórbico)

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration` | • **Inicio de Efectos:** Progresivo desde la primera sesión.<br>• **Duración:** Según protocolo de mantenimiento (cada 2 a 4 semanas). |
| **Presentación** | `reconstitution` | • **No requiere reconstitución:** Solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Aumento de antioxidantes y vitaminas.<br>• Protección de la piel frente al daño solar y radicales libres.<br>• Prevención del envejecimiento y reversión de signos de fotoenvejecimiento. |
| **Seguridad Clínica** | `contraindications` | • Heridas, úlceras, lesiones infectadas o dermatosis supurante.<br>• Intolerancia o hipersensibilidad individual a cualquiera de los componentes. |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, enrojecimiento leve o prurito en el sitio de punción (remisión típica en < 72 h). |
| **Seguridad Clínica** | `post-care-notes` | • Suspender o ajustar el tratamiento ante intolerancia individual. |

---

### 2. ANTIAGING (MCCM, España)
* **Categoría:** Mesoterapia Regenerativa | Ampolleta de 5 ml / Vial de 10 ml
* **Ingredientes Activos:** Ácido Hialurónico, Pantenol, DMAE, Silicio Orgánico, Centella Asiática

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration` | • **Inicio de Efectos:** Progresivo desde la primera sesión.<br>• **Duración:** Mantenimiento cada 2 a 4 semanas. |
| **Presentación** | `reconstitution` | • **No requiere reconstitución:** Solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Atenuación de líneas finas de expresión.<br>• Aporte de firmeza y turgencia cutánea.<br>• Hidratación profunda y nutrición celular.<br>• Efecto regenerativo y antioxidante integral. |
| **Seguridad Clínica** | `contraindications` | • Heridas, úlceras, lesiones infectadas o dermatosis supurante.<br>• Hipersensibilidad a cualquiera de los componentes de la fórmula.<br>• Pacientes hipertensos o con enfermedades crónicas en descontrol.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, enrojecimiento leve o prurito en el sitio de punción (resolución < 72 h). |
| **Seguridad Clínica** | `post-care-notes` | • Monitorear la zona tratada durante las primeras 72 horas. |

---

### 3. ARGIRELINE (MCCM, España)
* **Categoría:** Mesoterapia Regenerativa / Antiarrugas | Ampolleta de 2 ml
* **Ingredientes Activos:** Argireline (Hexapéptido)

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration` | • **Inicio de Efectos:** Progresivo desde las primeras sesiones.<br>• **Efecto:** Activador de colágeno y elastina (efecto botox-like natural). |
| **Presentación** | `reconstitution` | • **No requiere reconstitución:** Solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Tratamiento antiarrugas y prevención de líneas de expresión.<br>• Reducción de arrugas dinámicas en frente, entrecejo y región periocular.<br>• Atenuación de líneas finas peribucales ("código de barras"). |
| **Seguridad Clínica** | `contraindications` | • Heridas, úlceras, lesiones infectadas o dermatosis supurante.<br>• Hipersensibilidad al hexapéptido o componentes.<br>• Pacientes hipertensos o con enfermedades crónicas en descontrol.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, enrojecimiento o prurito en sitio de punción (< 72 h). |

---

### 4. ARTICHOKE (MCCM, España)
* **Categoría:** Mesoterapia Lipolítica y Drenante | Ampolleta de 5 ml
* **Ingredientes Activos:** Extracto de Alcachofa

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration` | • **Inicio de Efectos:** Progresivo según drenaje linfático. |
| **Presentación** | `reconstitution` | • **No requiere reconstitución:** Solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Tratamiento de celulitis edematosa y grasa localizada.<br>• Estimulación del metabolismo lipídico.<br>• Reducción de la retención de líquidos (propiedades diuréticas y desintoxicantes). |
| **Seguridad Clínica** | `contraindications` | • Heridas, úlceras, lesiones infectadas o dermatosis supurante.<br>• Hipersensibilidad al extracto de alcachofa.<br>• Pacientes con enfermedades crónicas en descontrol.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, enrojecimiento o prurito en el sitio de punción (< 72 h). |
| **Seguridad Clínica** | `post-care-notes` | • Fomentar la ingesta adecuada de agua post-sesión para favorecer el drenaje linfático. |

---

### 5. ASIAN CENTELLA (MCCM, España)
* **Categoría:** Mesoterapia Lipolítica y Regenerativa | Ampolleta de 5 ml
* **Ingredientes Activos:** Extracto de Centella Asiática

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration` | • **Inicio de Efectos:** Progresivo en remodelado y drenaje. |
| **Presentación** | `reconstitution` | • **No requiere reconstitución:** Solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Reducción de retención de líquidos (efecto drenante y antioxidante).<br>• Apoyo al metabolismo lipídico y reducción de celulitis.<br>• Estimulación de la síntesis de colágeno, prevención y tratamiento de fibrosis. |
| **Seguridad Clínica** | `contraindications` | • Heridas, úlceras, lesiones infectadas o dermatosis supurante.<br>• Hipersensibilidad a la Centella Asiática.<br>• Enfermedades crónicas descontroladas.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, enrojecimiento leve o prurito local (< 72 h). |

---

### 6. B-COMPLEX (MCCM, España)
* **Categoría:** Mesoterapia Regenerativa / Complejo Vitamínico | Ampolleta de 5 ml
* **Ingredientes Activos:** Vitaminas B1, B3, B6, B9, B12

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration` | • **Inicio de Efectos:** Progresivo en nutrición cutánea. |
| **Presentación** | `reconstitution` | • **No requiere reconstitución:** Solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Regeneración y nutrición en pieles dañadas, fotoenvejecidas o de fumador.<br>• Prevención del envejecimiento cutáneo prematuro.<br>• Coadyuvante y complementamiento de cualquier procedimiento estético. |
| **Seguridad Clínica** | `contraindications` | • Heridas, úlceras, lesiones infectadas o dermatosis supurante.<br>• Hipersensibilidad a cualquiera de las vitaminas del complejo B.<br>• Pacientes hipertensos o con patologías crónicas descontroladas.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, enrojecimiento o prurito transitorio (< 72 h). |

---

### 7. BELLATOXEL (Protox, Corea del Sur)
* **Categoría:** Neuromodulador / Toxina Botulínica Tipo A | Vial Liofilizado 100 UI
* **Ingredientes Activos:** Clostridium Botulinum Tipo A (100 UI), Albúmina Sérica Humana (0.5 mg), Cloruro de Sodio (0.9 mg)

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration`<br>`recommendedDose` | • **Inicio de Efectos:** 5 a 7 días.<br>• **Duración:** Hasta 6 meses.<br>• **Dosis Recomendada:** 10 UI / 0.1 mL tras reconstitución. |
| **Presentación** | `reconstitution` | • **Procedimiento a Nivel Presentación:**<br>  - *diluentType*: Solución salina estéril al 0.9% sin conservadores.<br>  - *volumeMl*: `1`<br>  - *instructions*: "Reconstituir exclusivamente con 1 mL de solución salina estéril al 0.9% (refrigerada para evitar choque térmico). Inyectar lentamente en el vial evitando agitación o formación de burbujas hasta obtener 10 UI por 0.1 mL. Registrar fecha y hora de reconstitución." |
| **Seguridad Clínica** | `clinical-indications` | • Mejora temporal de arrugas faciales y líneas glabelares moderadas a severas (asociadas al músculo corrugador superciliar y prócer).<br>• Relajación muscular y suavización visible de líneas de expresión. |
| **Seguridad Clínica** | `contraindications` | • Hipersensibilidad a la toxina botulínica, albúmina o componentes.<br>• Trastornos neuromusculares (miastenia gravis, Lambert-Eaton, ELA).<br>• Infección o proceso inflamatorio en el sitio de inyección previsto.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Dolor local, hematoma, inflamación o sensación de presión.<br>• Debilidad muscular localizada.<br>• Ptosis palpebral o debilidad en músculos adyacentes por difusión de la toxina. |
| **Seguridad Clínica** | `safety-warnings` | • **Uso médico especializado exclusivo** por profesionales capacitados en anatomía periocular, nervios faciales y EMG.<br>• Conservar en refrigeración de 2 °C a 8 °C. Usar preferentemente en 24 h (máximo 7 a 10 días). |

---

### 8. BIOTIN HIDRIXIN (MCCM, España)
* **Categoría:** Mesoterapia Capilar | Ampolleta de 2 ml
* **Ingredientes Activos:** Vitamina B7 (Biotina)

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration` | • **Inicio de Efectos:** Progresivo en la calidad del folículo. |
| **Presentación** | `reconstitution` | • **No requiere reconstitución:** Solución líquida lista para usar. |
| **Seguridad Clínica** | `clinical-indications` | • Tratamiento para combatir la caída y el adelgazamiento del cabello.<br>• Fortalecimiento capilar y nutrición del folículo piloso.<br>• Acción astringente natural y equilibrio de la función sebácea del cuero cabelludo. |
| **Seguridad Clínica** | `contraindications` | • Heridas, úlceras, lesiones infectadas o dermatosis supurante en cuero cabelludo.<br>• Hipersensibilidad a la biotina o componentes de la fórmula.<br>• Pacientes con enfermedades crónicas en descontrol.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Dolor leve, enrojecimiento o prurito en el sitio de punción (< 72 h). |
| **Seguridad Clínica** | `post-care-notes` | • Evitar el lavado de cabello con agua muy caliente o productos agresivos durante las primeras 12-24 h. |

---

### 9. BOTULAX (Hugelpharma, Corea del Sur)
* **Categoría:** Neuromodulador / Toxina Botulínica Tipo A | Vial Liofilizado 100 UI
* **Ingredientes Activos:** Clostridium Botulinum Tipo A (100 UI), Albúmina Sérica Humana (0.5 mg), Cloruro de Sodio (0.9 mg)

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration`<br>`recommendedDose` | • **Inicio de Efectos:** 5 a 7 días (efecto máximo de 10 a 17 días).<br>• **Duración:** 4 a 6 meses.<br>• **Dosis Recomendada:** 2 a 4 UI por punto (aguja 30G x 6mm). |
| **Presentación** | `reconstitution` | • **Procedimiento a Nivel Presentación:**<br>  - *diluentType*: Solución salina estéril al 0.9%.<br>  - *volumeMl*: `1`<br>  - *instructions*: "Reconstituir con 1 mL de solución salina al 0.9% (refrigerada para evitar choque térmico) para obtener 10 UI por 0.1 mL." |
| **Seguridad Clínica** | `clinical-indications` | • Mejora temporal de arrugas del rostro de moderadas a graves (tercio superior, glabela, frente, patas de gallo). |
| **Seguridad Clínica** | `contraindications` | • Hipersensibilidad conocida a la albúmina, proteínas de huevo o componentes.<br>• Enfermedades neuromusculares (miastenia gravis, esclerosis múltiple, ELA, Lambert-Eaton).<br>• Proceso inflamatorio o infeccioso en la zona de punción.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Leves: Dolor, edema, eritema, equimosis, cefalea, hiperestesia transitoria.<br>• Sistémicos: Náuseas, fatiga, malestar, sintomatología pseudogripal.<br>• Complicaciones: Parálisis incompleta, ptosis palpebral, hipersensibilidad o difusión. |
| **Seguridad Clínica** | `safety-warnings` | • Requiere refrigeración de 2 °C a 8 °C. Usar en 24 h.<br>• **Interacción Medicamentosa:** Precaución con aminoglucósidos, sulfato de magnesio, quinina, polimixina, tetraciclina, lincomicina y fármacos anticolinérgicos. |

---

### 10. BTSA9 (Protox, Corea del Sur)
* **Categoría:** Neuromodulador / Toxina Botulínica Tipo A | Vial Liofilizado 100 UI
* **Ingredientes Activos:** Toxina Botulínica Tipo A (100 UI), Cloruro de Sodio (0.9 mg), Albúmina Sérica Humana (0.5 mg)

| Nivel de Carga | Campo / Colección | Información Clínica Extraída |
| :--- | :--- | :--- |
| **Protocolo de Aplicación** | `visibleEffectsOnset`<br>`effectDuration`<br>`recommendedDose` | • **Inicio de Efectos:** 5 a 7 días.<br>• **Duración:** Hasta 6 meses.<br>• **Dosis Recomendada:** 2 a 4 UI por punto (aguja 30G x 6mm). |
| **Presentación** | `reconstitution` | • **Procedimiento a Nivel Presentación:**<br>  - *diluentType*: Solución salina estéril al 0.9%.<br>  - *volumeMl*: `1`<br>  - *instructions*: "Reconstituir con 1 mL de solución salina al 0.9% (refrigerada para evitar choque térmico) para obtener 10 UI por 0.1 mL." |
| **Producto / Presentación** | `certifications` | • Aprobado por la KFDA (Corea del Sur). |
| **Seguridad Clínica** | `clinical-indications` | • Potente tensor muscular para la atenuación de arrugas hipercinéticas faciales y líneas de expresión. |
| **Seguridad Clínica** | `contraindications` | • Hipersensibilidad conocida a la albúmina, proteínas de huevo o componentes.<br>• Enfermedades neuromusculares (miastenia gravis, esclerosis múltiple, ELA, Lambert-Eaton).<br>• Proceso inflamatorio o infeccioso activo en el sitio de punción.<br>• Embarazo y lactancia. |
| **Seguridad Clínica** | `adverse-effects` | • Leves: Dolor, edema, eritema, equimosis, cefalea, hiperestesia transitoria.<br>• Sistémicos: Náuseas, fatiga, malestar general, síntomas pseudogripales.<br>• Complicaciones: Parálisis incompleta muscular, ptosis o difusión del efecto. |
| **Seguridad Clínica** | `safety-warnings` | • Requiere refrigeración de 2 °C a 8 °C. Usar dentro de las 24 h tras reconstituir.<br>• **Interacción Medicamentosa:** Precaución con aminoglucósidos, anticolinérgicos, sulfato de magnesio, quinina, polimixina y tetraciclina. |

---

## 🎯 Resumen de Arquitectura y Reglas de Carga

1. **Protocolo de Aplicación (`protocols`)**: Es el dueño único de los campos de **Inicio de Efectos** (`visibleEffectsOnset`) y **Duración del Efecto** (`effectDuration`), además de las dosis, sesiones y frecuencia.
2. **Presentación Comercial (`presentations.reconstitution`)**: Es el dueño único del procedimiento de **Reconstitución / Dilución** (`diluentType`, `volumeMl`, `instructions`), aplicando únicamente para presentaciones que lo requieran (viales liofilizados como `BELLATOXEL`, `BOTULAX`, `BTSA9`).
3. **Colecciones Relacionales (`Seguridad Clínica`)**: Mantienen estrictamente `clinical-indications`, `contraindications`, `adverse-effects`, `post-care-notes` y `safety-warnings`.
