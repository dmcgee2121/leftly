import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ItemRow } from '../src/components/ItemRow'

describe('ItemRow accessibility', () => {
  it('names the action and describes the visible details', () => {
    const html = renderToStaticMarkup(
      <ItemRow title="Phone" subtitle="Due Dec 11 · Utilities" amount="$85.00" status="Unpaid" onOpen={() => {}} openLabel="Edit bill Phone" />,
    )
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1]
    expect(html).toContain('aria-label="Edit bill Phone"')
    expect(describedBy).toBeTruthy()
    expect(html).toContain(`id="${describedBy}" class="sr-only">$85.00, Due Dec 11 · Utilities, Unpaid</span>`)
  })
})
