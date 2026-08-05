import { getPayload } from 'payload'
import configPromise from '../src/payload.config'
import { toProductPdfViewModel, ProductPdfIncompleteGraphError } from '../src/lib/product-pdf/model'

async function diagnose() {
  const payload = await getPayload({ config: configPromise })
  
  const products = await payload.find({
    collection: 'products',
    depth: 5,
    limit: 100,
  })

  console.log(`Checking ${products.docs.length} products...`)

  for (const product of products.docs) {
    try {
      toProductPdfViewModel(product as any)
      console.log(`✅ Product ID ${product.id} (${product.canonicalName}): OK`)
    } catch (err: any) {
      if (err instanceof ProductPdfIncompleteGraphError) {
        console.error(`❌ Product ID ${product.id} (${product.canonicalName}): INCOMPLETE_PRODUCT_GRAPH at path: "${err.message}"`)
      } else {
        console.error(`❌ Product ID ${product.id} (${product.canonicalName}): ${err.stack || err.message}`)
      }
    }
  }

  process.exit(0)
}

diagnose().catch(err => {
  console.error(err)
  process.exit(1)
})
