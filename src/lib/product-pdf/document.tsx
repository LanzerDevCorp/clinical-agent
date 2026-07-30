import 'server-only'

import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer'
import type { ProductPdfViewModel } from './model'

const styles = StyleSheet.create({
  page: { padding: 32, fontFamily: 'Helvetica', fontSize: 9, color: '#1f2937' },
  title: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 8 },
  section: { marginTop: 12 },
  heading: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 4},
  label: { fontFamily: 'Helvetica-Bold' },
  item: { marginBottom: 3 },
  warning: { color: '#991b1b', fontFamily: 'Helvetica-Bold', fontSize: 8, bottom: 16, left: 32, position: 'absolute' },
  approved: { color: '#166534', fontFamily: 'Helvetica-Bold' },
})

const contraindicationLabels: Record<ProductPdfViewModel['clinicalSafety']['contraindications'][number]['type'], string> = {
  absoluta: 'Absoluta',
  relativa: 'Relativa',
}
const clinicalNoteLabels: Record<ProductPdfViewModel['presentations'][number]['clinicalNotes'][number]['type'], string> = {
  indicacion_clinica: 'Indicación clínica',
  cuidado_post_aplicacion: 'Cuidado post-aplicación',
  advertencia_seguridad: 'Advertencia de seguridad',
}
const productTypeLabels: Record<string, string> = {
  liofilizado: 'Liofilizado',
  liquido: 'Líquido',
  hilos_pdo: 'Hilos PDO',
  dispositivo_medico: 'Dispositivo Médico',
  insumo: 'Insumo de Aplicación',
  otro: 'Otro',
}
const presentationStatusLabels: Record<string, string> = {
  activa: 'Activa',
  descontinuada: 'Descontinuada',
}

function formatLabel(value: string, labels: Record<string, string>): string {
  if (!value || value === 'No informado') return value
  if (labels[value]) return labels[value]
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function getPdfStatusLabel(status: ProductPdfViewModel['traceability']['validationStatus']): string {
  return status === 'PENDING' ? 'PENDIENTE DE VALIDACIÓN — NO APROBADO' : 'Aprobado'
}

function Field({ label, value }: { label: string; value: string | string[] }) {
  return <Text style={styles.item}><Text style={styles.label}>{label}: </Text>{Array.isArray(value) ? value.join(', ') : value}</Text>
}

function ClassifiedFields({ label, entries, labels }: {
  label: string
  entries: Array<{ type: string; description: string }>
  labels: Record<string, string>
}) {
  if (entries.length === 0) return <Field label={label} value="Sin registros" />
  return <View><Text style={styles.label}>{label}</Text>{entries.map((entry, index) => (
    <Text key={`${entry.type}-${index}`} style={styles.item}><Text style={styles.label}>{labels[entry.type]}: </Text>{entry.description}</Text>
  ))}</View>
}

export function ProductPdfDocument({ model }: { model: ProductPdfViewModel }) {
  const { traceability, general, clinicalSafety, presentations } = model
  const pending = traceability.validationStatus === 'PENDING'

  return (
    <Document title={traceability.canonicalName}>
      <Page size="A4" style={styles.page} wrap>
        {pending && <Text fixed style={styles.warning}>{getPdfStatusLabel('PENDING')}</Text>}
        <Text style={styles.title}>{traceability.canonicalName}</Text>
        {!pending && <Text style={styles.approved}>{getPdfStatusLabel('APPROVED')}</Text>}
        <View style={styles.section}>
          <Text style={styles.heading}>Trazabilidad</Text>
          <Field label="ID de producto" value={traceability.productId} />
          <Field label="Estado de validación" value={traceability.validationStatus} />
          <Field label="Notas de validación" value={traceability.validationNotes} />
          <Field label="Creado" value={traceability.createdAt} />
          <Field label="Actualizado" value={traceability.updatedAt} />
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>General</Text>
          <Field label="Tipo de producto" value={formatLabel(general.productType, productTypeLabels)} />
          <Field label="Laboratorio" value={general.laboratory} />
          <Field label="Ingredientes activos" value={general.activeIngredients} />
          <Field label="Sinónimos" value={general.aliases} />
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Seguridad clínica</Text>
          <ClassifiedFields label="Contraindicaciones" entries={clinicalSafety.contraindications} labels={contraindicationLabels} />
          <Field label="Efectos adversos" value={clinicalSafety.adverseEffects} />
        </View>
        <View style={styles.section}>
          <Text style={styles.heading}>Presentaciones</Text>
          {presentations.length === 0 ? <Text>Sin registros</Text> : presentations.map((presentation, index) => (
            <View key={`${presentation.canonicalName}-${index}`} style={styles.section}>
              <Text style={styles.heading}>{presentation.canonicalName}</Text>
              <Field label="Estado" value={formatLabel(presentation.status, presentationStatusLabels)} />
              <Field label="Sinónimos" value={presentation.aliases} />
              <ClassifiedFields label="Notas clínicas" entries={presentation.clinicalNotes} labels={clinicalNoteLabels} />
              <View style={styles.section}>
                <Text style={styles.heading}>Reconstitución / Dilución</Text>
                <Field label="Tipo de diluyente" value={presentation.reconstitution.diluentType} />
                <Field label="Volumen (mL)" value={presentation.reconstitution.volumeMl} />
                <Field label="Instrucciones" value={presentation.reconstitution.instructions} />
              </View>
              <Text style={{fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 4, marginTop: 4}}>Protocolos</Text>
              {presentation.protocols.length === 0 ? <Text>Sin registros</Text> : presentation.protocols.map((protocol, protocolIndex) => (
                <View key={`${protocol.name}-${protocolIndex}`} style={styles.item}>
                  <Field label="Nombre" value={protocol.name} />
                  <Field label="Zonas" value={protocol.zones} />
                  <Field label="Vías" value={protocol.routes} />
                  <Field label="Técnicas" value={protocol.techniques} />
                  <Field label="Sesiones mínimas" value={protocol.sessionsMin} />
                  <Field label="Sesiones máximas" value={protocol.sessionsMax} />
                  <Field label="Frecuencia" value={protocol.frequency} />
                </View>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  )
}

export function renderProductPdf(model: ProductPdfViewModel): Promise<Buffer> {
  return renderToBuffer(<ProductPdfDocument model={model} />)
}
