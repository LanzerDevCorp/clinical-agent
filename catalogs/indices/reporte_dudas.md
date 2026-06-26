# Reporte Consolidado de Dudas Clínicas (Para la Doctora)

Este reporte contiene todas las dudas de asignación identificadas en los catálogos para confirmar cómo se debe tratar o interpretar la información.

---

## Catálogo: Bioestimuladores, Biorevitalizador y Exosomas

- **REJUBELLA - Clasificación clínica**: El catálogo la agrupa como "bioestimulador" junto a ULTRA CA+, pero la describe como **relleno dérmico de Polidioxanona** y aclara que "NO produce efecto implante". ¿Debe comunicarse al paciente como bioestimuladora o como relleno dérmico/estimulador de colágeno? Confirmar categoría correcta para el agente.

- **REJUBELLA / ULTRA CA+ - Dosis de lidocaína**: Para ULTRA CA+ el protocolo indica **0.2 ml de lidocaína por jeringa**. Para REJUBELLA indica **1-2 ml de lidocaína** sin especificar concentración ni si es por vial o por sesión. ¿Es correcta esa dosis o hay un error de redacción?

- **ULTRAHILO - Puntos TPS en cuello incompletos**: El protocolo lista 10 puntos TPS para cuello pero la numeración salta del "5. y 6." al "6. y 8." (omite el punto 7). Faltan al menos 2-3 puntos del protocolo completo. Proporcionar los puntos 7, 8, 9 y 10 para completar la técnica.

---

## Catálogo: Mesoterapia Capilar

- **BIOTIN HIDRIXIN / PROF HAIR - Sección de aplicación combinada**: El catálogo mezcla ambos productos en una sola sección de aplicación ("Biotin hidrixin Ampolleta 5 ml / Hair Vial 10 ml"). No queda claro si "Hair Vial" es el nombre de PROF HAIR, si la dosis de 0.01-0.03 ml aplica a ambos, ni si el protocolo de sesiones es idéntico para los dos. Confirmar si los datos son válidos para ambos productos o si cada uno tiene su protocolo propio.

- **PROF HAIR - Dosis no especificada de forma independiente**: No existe sección individual de aplicación para PROF HAIR. Los datos de dosis provienen de la sección combinada con BIOTIN HIDRIXIN. Confirmar dosis, aguja y frecuencia correctas para PROF HAIR.

- **FINASTERIDE / MINOXIDIL - Efectos sistémicos por vía intradérmica**: Los efectos adversos sistémicos listados (libido, función sexual, ánimo, sensibilidad mamaria) son clásicamente atribuibles al **Finasteride oral**. El catálogo no aclara si MINOXIDIL intradérmico puede producir efectos sistémicos propios (ej. hipotensión). Confirmar qué efectos corresponden a cada producto por vía intradérmica para informar correctamente al paciente.

---

## Catálogo: Dermapen, Agujas y Aditamentos

- **GLOWPEN PRO vs. DERMAPEN - ¿Son el mismo dispositivo?**: El catálogo los presenta juntos como "Dermapen GLOWPEN PRO" describiendo un solo equipo (FR-DP01), pero en `registry.json` son dos entradas separadas. Confirmar si son el mismo producto con nombres distintos, o dispositivos diferentes que requieren fichas individuales.

- **Tablas de colores de agujas contradictorias**: El catálogo incluye dos tablas de referencia de gauge/color que no coinciden (ej. 21G = verde/0.80mm vs. purple/0.83mm; 27G = gris/0.40mm vs. white/0.42mm). El propio catálogo advierte que el color varía por marca. Confirmar si se debe conservar una sola tabla como referencia oficial, y cuál es la correcta.

---

## Catálogo: Despigmentantes

- **TRANEXAMICUM - Unidad "1500 UI"**: El ácido tranexámico se mide en mg o %, no en UI (unidad para enzimas y vitaminas liposolubles). El catálogo dice "Ácido tranexámico 1500 UI". Confirmar si es la concentración correcta tal como viene el vial, o si hay un error (ej. 1500 mg o un porcentaje).

- **WHITENING - Aplicación en zona periorbitaria (ojeras)**: WHITENING está indicado para ojeras pero el catálogo no detalla técnica, profundidad ni dosis específica para esa zona. La zona periorbitaria es anatómicamente delicada. Proporcionar protocolo específico para esta indicación.

---

## Catálogo: Enzimas

- **Aguja "39G-4mm" — posible error tipográfico crítico**: El protocolo de aplicación (facial y corporal) indica "Aguja 39G-4mm". Esta medida prácticamente no existe en uso clínico estético y no soporta los volúmenes indicados (0.1-0.5 ml). Con alta probabilidad es un error por **30G-4mm**. Confirmar la aguja correcta antes de difundir este protocolo.

- **Productos del registro sin catálogo**: COLAGENASA (sin "1500 UI"), CLH LIQUIDA y CLH LIPASE (sin número) están en `registry.json` pero no aparecen en el catálogo de enzimas. Confirmar si son variantes de los productos ya documentados o si requieren fichas independientes.

- **Recomendaciones sin explicar**: Tres ítems de post-aplicación tienen asterisco sin nota de pie: "Barbicuello" (se desconoce a qué se refiere), "Fitoterapia MCCM" (no especifica qué producto) e "Ingesta de carbohidratos los primeros 5 días" (sin racional clínico). Confirmar qué significa cada uno y a qué productos aplica.

---

## Catálogo: Hidratantes

- **HYALURONIDASE LIQUID categorizada como hidratante**: En `registry.json` está bajo "Mesoterapia Hidratantes", pero la hialuronidasa es una enzima que **degrada** el ácido hialurónico (disuelve rellenos, trata retención de líquidos). No aparece en el catálogo de hidratantes. Confirmar categoría correcta y si debe documentarse con las enzimas.

- **HYALURONIC ACID vs. DNA - Número de sesiones distinto**: HYALURONIC ACID indica 3 sesiones y DNA indica 4-6, ambos 1 vez por semana con misma dosis por punción. Confirmar si la diferencia es intencional o debe unificarse.

---

## Catálogo: Hilos PDO

- **Medidas de hilos no coinciden con el registro**: El catálogo menciona medidas que NO están en `registry.json`: MONO 27G-50 y 29G-60; Tornado 27G-50; COG 19G-100 y 21G-90. A la inversa, el registro tiene un producto genérico "HILOS PDO" sin medida. Confirmar: (1) ¿son medidas reales que faltan en el registro o errores del catálogo? (2) ¿a qué corresponde el genérico "HILOS PDO"?

---

## Catálogo: Lipolíticos

- **Error de dosis crítico: "1.01 - 0.03 ml por punción"**: El protocolo general indica un rango imposible (1.01 es mayor que 0.03). Con alta probabilidad es error por **0.01 - 0.03 ml** (rango estándar del resto de catálogos). 1.01 ml por punción sería sobredosis grave. Confirmar y corregir con urgencia.

- **ASIAN CENTELLA y CELLESTABYL sin ficha en el catálogo**: Ambos figuran en `registry.json` (Lipolíticos) pero no aparecen en el catálogo. "Centella asiática" se menciona solo como componente de otros cócteles. Confirmar si son productos individuales que necesitan ficha propia.

---

## Catálogo: Otros Productos

- **WICKED SNOW WHITE sin ficha**: Figura en `registry.json` pero no aparece en ningún catálogo procesado. Confirmar qué es y proporcionar ficha técnica.

- **LIPOLAB - Riesgo sistémico y disolución de músculos/nervios**: El catálogo advierte que el PPC "podría disolver músculos y nervios" y lista efectos sistémicos graves (arritmias). Confirmar si debe llevar advertencia de seguridad destacada y un protocolo de profundidad/dosis máxima específico.

- **PINK INTIMATE SYSTEM - Datos inconsistentes de rendimiento/sesiones**: El catálogo da cifras contradictorias: rendimiento por vial "hasta cinco sesiones" vs. "3 sesiones"; número de sesiones "entre 4 y 5" vs. "entre 3 y 6". Confirmar las cifras correctas.

---

## Catálogo: Mesoterapia Regenerativa (MCCM)

- **Error de dosis "1.01 – 0.03 ml por punción"**: Mismo error crítico que en Lipolíticos. Rango imposible, probable typo por **0.01 - 0.03 ml**. Corregir en ambos catálogos para evitar sobredosis.

- **LAURETH es intravenoso, no mesoterapia**: LAURETH (Laureth-9, esclerosante) está en el catálogo de regenerativos pero su vía es INTRAVENOSA (escleroterapia de varices), distinta del resto. La sección "Contraindicaciones de todos los activos de mesoterapia" no aplica igual a un esclerosante IV. Confirmar si debe separarse en su propia categoría y qué contraindicaciones específicas tiene por su vía y perfil de riesgo (necrosis, trombosis).

- **VITAMINA A sin ficha individual**: Figura en `registry.json` (MCCM) pero solo se menciona como componente de AEC y SKIN REPAIR. Confirmar si se vende como producto individual.

---

## Catálogo: Rellenos de Ácido Hialurónico

- **CELOSOME IMPLANT - Tamaño de aguja "2G" imposible**: La ficha indica aguja "2G" (~6.5 mm de diámetro, uso industrial/veterinario), imposible para relleno facial. Probable typo por **26G o 27G**. Corregir con urgencia.

- **"Sofiderm Deep" duplicado**: Aparece dos veces — una versión facial con aguja (subcutáneo/periostio) y otra corporal sin aguja (mamas, glúteos, etc.). El registro tiene SOFIDERM DEEP y SOFIDERM DERM SUB SKIN separados. Confirmar si la versión corporal corresponde a SOFIDERM DERM SUB SKIN.

- **ULTRAFILL NOSE - Aguja/cánula inconsistentes**: La ficha mezcla calibres ("27G-29G (25G-13)") y una cánula 23G-40 que no aparece en otras fichas. Confirmar aguja y cánula correctas.

- **ULTRABODY - "Sin contraindicaciones" contradice la sección general**: Su ficha dice "sin contraindicaciones por su contenido", pero el catálogo lista contraindicaciones generales para todos los rellenos. Confirmar cuál aplica.

- **Genéricos "ULTRAFILL" y "WIZFILL PLUS" sin medida**: El registro tiene entradas genéricas sin sufijo además de las variantes numeradas. Confirmar si son productos base o duplicados a consolidar.

---

## Catálogo: Skin Boosters

- **SOFIDERM SKIN BOOSTER sin ficha**: Figura en `registry.json` pero no tiene ficha en el catálogo. Confirmar si es distinto a SOFIDERM RESURRECTION / WRINKLE FIGHTER.

- **Dos protocolos de cuidados post-aplicación distintos**: El catálogo tiene un bloque de cuidados para SOFIDERM (no maquillaje 12h, evitar frío/calor) y otro para NCTF/Dr.DMAE (no maquillaje 4h, evitar agua de mar). Confirmar qué aplica a cada producto o unificar.

---

## Catálogo: Toxinas

- **BELLATOXEL sin ficha**: Figura en `registry.json` (Toxinas) pero no aparece en el catálogo. Confirmar composición, unidades, duración y diluciones.

- **METOX - Diferencias de formulación**: Indica NaCl 0.8 mg (las demás 0.9 mg) y duración 3-4 meses (las demás 4-6). Confirmar si son correctas (deshidratación al vacío) o errores de transcripción.

- **Contraindicaciones atípicas**: "Pacientes menores de 25 años" (relativa) — confirmar si es criterio de la clínica o del producto. "Alergia al huevo" (absoluta) — atípica para toxina botulínica. Confirmar si corresponde a la formulación o es error.
