import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  VIEWS,
  DEFAULT_VIEW,
  parseViewParam,
  viewHref,
} from '@/lib/navigation'

test('view-param-parsing-defaults-to-today', () => {
  assert.equal(parseViewParam(null), 'today')
  assert.equal(parseViewParam(''), 'today')
  assert.equal(parseViewParam('unknown'), 'today')
  assert.equal(parseViewParam('xyz'), 'today')
  assert.equal(parseViewParam('today'), 'today')
  assert.equal(parseViewParam('Today'), 'today')
  assert.equal(parseViewParam('dashboard'), 'dashboard')
  assert.equal(parseViewParam('deals'), 'deals')
  assert.equal(parseViewParam('projects'), 'projects')
  assert.equal(parseViewParam('companies'), 'companies')
  assert.equal(parseViewParam('contacts'), 'contacts')
  assert.equal(parseViewParam('activities'), 'activities')
  assert.equal(parseViewParam('calendar'), 'calendar')
  assert.equal(parseViewParam('review'), 'review')
  assert.equal(parseViewParam('settings'), 'settings')
})

test('view-href-builds-query', () => {
  assert.equal(viewHref('today'), '/')
  assert.equal(viewHref('dashboard'), '/?view=dashboard')
  assert.equal(viewHref('projects'), '/?view=projects')
  assert.equal(viewHref('projects', { layout: 'list' }), '/?view=projects&layout=list')
  assert.equal(viewHref('settings', { section: 'projects' }), '/?view=settings&section=projects')
  assert.equal(viewHref('today', { section: 'sales' }), '/?view=today&section=sales')
})
