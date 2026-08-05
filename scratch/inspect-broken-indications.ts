import { getPayload } from 'payload'
import configPromise from '../src/payload.config'

async function inspectProduct() {
  const payload = await getPayload({ config: configPromise })
  
  const product = await payload.findByID({
    collection: 'products',
    id: 1, // AEC
    depth: 5,
  })

  console.log('AEC presentations[0].clinicalIndications:', (product.presentations?.[0] as any)?.clinicalIndications)
  
  for (const [i, item] of ((product.presentations?.[0] as any)?.clinicalIndications || []).entries()) {
    console.log(`Item ${i}: type=${typeof item}`, item)
  }

  process.exit(0)
}

inspectProduct().catch(err => {
  console.error(err)
  process.exit(1)
})
