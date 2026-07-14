import { expect, test } from '@playwright/test'
import { installNocturneMock } from './mockNocturne'

async function ready(page: import('@playwright/test').Page) {
  await page.goto('/')
  await expect(page.locator('.app-shell')).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

test.describe('renderer do produto', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-07-13T20:05:00.000Z'))
    await installNocturneMock(page)
  })

  test('mantém somente um painel modal e restaura o foco', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await expect(page.locator('#workspace-sidebar')).toHaveClass(/open/)
    await expect(page.locator('#agent-inspector')).toHaveClass(/open/)

    await page.setViewportSize({ width: 980, height: 820 })
    await expect(page.locator('#workspace-sidebar')).toHaveClass(/open/)
    await expect(page.locator('#agent-inspector')).toHaveClass(/closed/)
    await expect(page.locator('.panel-backdrop')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Recolher barra lateral' })).toBeFocused()

    await page.keyboard.press('Escape')
    const sidebarTrigger = page.getByRole('button', { name: 'Abrir barra lateral' })
    await expect(sidebarTrigger).toBeFocused()
    await expect(sidebarTrigger).toHaveAttribute('aria-expanded', 'false')

    const inspectorTrigger = page.getByRole('button', { name: 'Mostrar painel do agente' })
    await inspectorTrigger.click()
    await expect(page.locator('#workspace-sidebar')).toHaveClass(/collapsed/)
    await expect(page.locator('#agent-inspector')).toHaveClass(/open/)
    await expect(page.locator('.panel-backdrop')).toHaveCount(1)
    await expect(page.locator('#agent-inspector').getByRole('button', { name: 'Fechar painel do agente' })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Mostrar painel do agente' })).toBeFocused()
  })

  test('prende a tabulação no painel compacto', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 800 })
    await ready(page)
    await page.getByRole('button', { name: 'Abrir barra lateral' }).click()
    const first = page.getByRole('button', { name: 'Recolher barra lateral' })
    const last = page.locator('#workspace-sidebar').getByRole('button', { name: 'Abrir configurações' })
    await expect(first).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(last).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(first).toBeFocused()
  })

  test('faz o composer crescer até o limite e restaura a altura', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 850 })
    await ready(page)
    const composer = page.locator('#prompt-composer')
    const initialHeight = await composer.evaluate((element) => element.getBoundingClientRect().height)
    await composer.fill(Array.from({ length: 8 }, (_, index) => `Linha ${index + 1} com uma instrução detalhada.`).join('\n'))
    const expandedHeight = await composer.evaluate((element) => element.getBoundingClientRect().height)
    expect(expandedHeight).toBeGreaterThan(initialHeight)
    expect(expandedHeight).toBeLessThanOrEqual(220)
    await composer.fill(Array.from({ length: 40 }, (_, index) => `Linha extensa ${index + 1}.`).join('\n'))
    await expect(composer).toHaveCSS('overflow-y', 'auto')
    await composer.fill('')
    await expect(composer).toHaveCSS('overflow-y', 'hidden')
    expect(await composer.evaluate((element) => element.getBoundingClientRect().height)).toBe(initialHeight)
  })

  test('mantém um símbolo textual do estado Codex em 520px', async ({ page }) => {
    await page.setViewportSize({ width: 520, height: 760 })
    await ready(page)
    const connection = page.getByRole('button', { name: /Codex:/ })
    await expect(connection.locator('.connection-symbol')).toBeVisible()
    await expect(connection.locator('.connection-symbol')).toHaveAttribute('data-symbol', 'ready')
    await page.evaluate(() => (window as unknown as { __nocturneTest: { emitStatus(payload: unknown): void } }).__nocturneTest.emitStatus({ status: 'failed' }))
    await expect(connection.locator('.connection-symbol')).toHaveAttribute('data-symbol', 'unavailable')
  })

  test('expõe streaming, erro e aprovação pendente sem deslocar controles essenciais', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.evaluate(() => {
      const bridge = (window as unknown as { __nocturneTest: { emitEvent(payload: unknown): void; emitStatus(payload: unknown): void } }).__nocturneTest
      bridge.emitStatus({ status: 'streaming' })
      bridge.emitEvent({ method: 'item/agentMessage/delta', params: { delta: 'Analisando a experiência em tempo real…' } })
      bridge.emitEvent({ method: 'item/commandExecution/requestApproval', params: { approvalKey: 'approval-1', command: 'npm test' } })
      bridge.emitEvent({ method: 'warning', params: { message: 'Validação visual pendente.' } })
      bridge.emitEvent({ method: 'error', params: { message: 'Falha simulada do renderer.' } })
    })
    await expect(page.getByText('Analisando a experiência em tempo real…')).toBeVisible()
    await expect(page.getByText('Decisões pendentes')).toBeVisible()
    await page.getByRole('button', { name: 'Ver detalhes técnicos' }).click()
    await expect(page.getByText('Validação visual pendente.')).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Falha simulada do renderer.')
    await expect(page.locator('.composer')).toBeVisible()
  })

  test('protege configurações editadas e fecha o diálogo com Escape', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.getByRole('button', { name: 'Abrir configurações' }).last().click()
    await expect(page.getByRole('dialog', { name: 'Configurações' })).toBeVisible()
    await page.getByRole('textbox', { name: 'Modelo' }).fill('modelo-local')
    await page.keyboard.press('Escape')
    await expect(page.getByText('Descartar alterações?')).toBeVisible()
    await page.getByRole('button', { name: 'Continuar editando' }).click()
    await expect(page.getByRole('textbox', { name: 'Modelo' })).toHaveValue('modelo-local')
  })

  test('mantém falhas de salvamento dentro do diálogo de configurações', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.evaluate(() => { window.nocturne.settings.set = async () => { throw new Error('Não foi possível salvar as configurações.') } })
    await page.getByRole('button', { name: 'Abrir configurações' }).last().click()
    await page.getByRole('textbox', { name: 'Modelo' }).fill('modelo-local')
    await page.getByRole('button', { name: 'Salvar alterações' }).click()
    const dialog = page.getByRole('dialog', { name: 'Configurações' })
    await expect(dialog.getByRole('alert')).toContainText('Não foi possível salvar as configurações.')
    await expect(dialog).toBeVisible()
  })

  test('protege e salva o contexto do workspace com feedback', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.getByRole('button', { name: 'Memória do workspace' }).click()
    const memory = page.getByRole('dialog', { name: 'Contexto do workspace' })
    await memory.getByLabel('Memória e decisões').fill('Decisão importante para o projeto.')
    await page.keyboard.press('Escape')
    await expect(memory.getByRole('alert')).toContainText('Descartar alterações?')
    await memory.getByRole('button', { name: 'Continuar editando' }).click()
    await memory.getByRole('button', { name: 'Salvar contexto' }).click()
    await expect(memory).toBeHidden()
    await expect(page.locator('.product-toast')).toContainText('Contexto do workspace salvo.')
  })

  test('mantém falhas de memória dentro do diálogo', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.evaluate(() => { window.nocturne.memory.set = async () => { throw new Error('Não foi possível salvar o contexto.') } })
    await page.getByRole('button', { name: 'Memória do workspace' }).click()
    const memory = page.getByRole('dialog', { name: 'Contexto do workspace' })
    await memory.getByLabel('Regras e padrões').fill('Sempre validar o pacote.')
    await memory.getByRole('button', { name: 'Salvar contexto' }).click()
    await expect(memory.getByRole('alert')).toContainText('Não foi possível salvar o contexto.')
    await expect(memory).toBeVisible()
  })

  test('confirma a criação de commit no próprio fluxo', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.getByText('Git e commit').click()
    await page.getByRole('textbox', { name: 'Mensagem do commit' }).fill('fix: confirmar operação')
    await page.getByRole('button', { name: 'Criar commit com arquivos selecionados' }).click()
    await expect(page.locator('.product-toast')).toContainText('Commit criado com sucesso.')
  })

  test('mantém falhas de clipboard dentro da solução aberta', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.evaluate(() => {
      window.nocturne.suggestions.list = async () => [{
        id: 'suggestion-1', workspaceId: 'workspace-1', conversationId: 'conversation-1', title: 'Melhorar feedback', description: 'Problema', reasoning: 'Evidência', category: 'accessibility', severity: 'medium', affectedFiles: ['src/App.tsx'], proposedChanges: '+ feedback', expectedBenefits: ['Mais confiança'], complexity: 'low', risk: 'low', status: 'pending', createdAt: '2026-07-13T20:00:00.000Z', updatedAt: '2026-07-13T20:00:00.000Z',
      }]
      window.nocturne.clipboard.writeText = async () => { throw new Error('Clipboard indisponível.') }
    })
    await page.locator('.conversation-open').click()
    await page.getByRole('tab', { name: /Sugestões/ }).click()
    const documentationMetric = page.locator('.health-grid span').filter({ hasText: 'Documentação' })
    const labelBox = await documentationMetric.getByText('Documentação', { exact: true }).boundingBox()
    const scoreBox = await documentationMetric.getByText('10/10', { exact: true }).boundingBox()
    expect(labelBox).not.toBeNull()
    expect(scoreBox).not.toBeNull()
    expect(scoreBox!.y).toBeGreaterThanOrEqual(labelBox!.y + labelBox!.height)
    await page.getByRole('button', { name: 'Ver solução' }).click()
    const dialog = page.getByRole('dialog', { name: 'Melhorar feedback' })
    await dialog.getByRole('button', { name: 'Copiar diff' }).click()
    await expect(dialog.getByRole('alert')).toContainText('Clipboard indisponível.')
  })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 980, height: 820 }, { width: 720, height: 800 }, { width: 520, height: 760 }]) {
    test(`mantém a referência visual em ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await ready(page)
      await expect(page).toHaveScreenshot(`renderer-${viewport.width}.png`, { animations: 'disabled', caret: 'hide', fullPage: true })
    })
  }
})

test('diferencia o estado vazio sem dados locais', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T20:05:00.000Z'))
  await installNocturneMock(page, { empty: true })
  await page.setViewportSize({ width: 1180, height: 850 })
  await ready(page)
  await expect(page.getByText('Nenhuma conversa ainda')).toBeVisible()
  await expect(page.getByText('O que vamos construir?')).toBeVisible()
})
