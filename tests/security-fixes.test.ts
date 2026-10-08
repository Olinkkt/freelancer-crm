import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { MarkdownFormatter } from '@/components/ui/markdown-formatter'

describe('Security Fixes: Markdown XSS Prevention', () => {
  it('neutralizes javascript: pseudo-protocols in links', () => {
    const maliciousInput = '[Exploit](javascript:alert(document.cookie))'
    const rendered = MarkdownFormatter({ content: maliciousInput }) as any

    // Extract children of root div
    const paragraph = rendered.props.children[0]
    const elements = React.Children.toArray(paragraph.props.children)

    // The link should NOT be rendered as an <a href="javascript:..."> anchor
    const anchor = elements.find((el: any) => el?.type === 'a')
    assert.equal(anchor, undefined, 'Must not render an <a> tag for javascript: URLs')

    // It should render safely as a <span> text element instead
    const span = elements.find((el: any) => el?.type === 'span') as any
    assert.ok(span, 'Should render as safe <span> text')
    assert.equal(span.props.children, 'Exploit')
  })

  it('neutralizes data: and vbscript: URIs in links', () => {
    const dataUri = '[DataLink](data:text/html,<script>alert(1)</script>)'
    const renderedData = MarkdownFormatter({ content: dataUri }) as any
    const paragraph1 = renderedData.props.children[0]
    const elements1 = React.Children.toArray(paragraph1.props.children)
    assert.equal(elements1.find((el: any) => el?.type === 'a'), undefined)

    const vbUri = '[VbLink](vbscript:msgbox(1))'
    const renderedVb = MarkdownFormatter({ content: vbUri }) as any
    const paragraph2 = renderedVb.props.children[0]
    const elements2 = React.Children.toArray(paragraph2.props.children)
    assert.equal(elements2.find((el: any) => el?.type === 'a'), undefined)
  })

  it('allows safe http://, https://, and relative URLs', () => {
    const safeInput = '[Google](https://google.com) and [Docs](/docs)'
    const rendered = MarkdownFormatter({ content: safeInput }) as any
    const paragraph = rendered.props.children[0]
    const elements = React.Children.toArray(paragraph.props.children)

    const anchors: any[] = elements.filter((el: any) => el?.type === 'a')
    assert.equal(anchors.length, 2)
    assert.equal(anchors[0].props.href, 'https://google.com')
    assert.equal(anchors[0].props.target, '_blank')
    assert.equal(anchors[0].props.rel, 'noopener noreferrer')
    assert.equal(anchors[1].props.href, '/docs')
  })
})
