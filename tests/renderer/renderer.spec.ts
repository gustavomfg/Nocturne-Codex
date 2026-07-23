import { expect, test } from '@playwright/test'
import { installNocturneMock } from './mockNocturne'
import type { Suggestion } from '../../src/types'

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

  test('expõe o atalho do workspace para o WebStorm', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await expect(page.getByRole('button', { name: 'Abrir no WebStorm' })).toBeVisible()
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
    await expect(page.getByRole('button', { name: 'Ocultar painel do agente' })).toHaveCount(0)
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

  test('mantém o acionador do inspector fora do painel quando a conversa passa a rolar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 760 })
    await ready(page)
    const trigger = page.getByRole('button', { name: 'Ocultar painel do agente' })
    const inspector = page.locator('#agent-inspector')
    const actions = page.locator('.top-actions')
    await expect(inspector).toHaveClass(/open/)
    await page.waitForTimeout(300)
    const before = await trigger.boundingBox()

    await page.evaluate(() => {
      const bridge = (window as unknown as { __nocturneTest: { emitEvent(payload: unknown): void; emitStatus(payload: unknown): void } }).__nocturneTest
      bridge.emitStatus({ status: 'waiting-approval' })
      bridge.emitEvent({ method: 'item/agentMessage/delta', params: { delta: 'Conteúdo em andamento.\n'.repeat(2_000) } })
    })

    await expect.poll(() => page.locator('.chat-scroll').evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true)
    const [after, actionsBox, inspectorBox] = await Promise.all([trigger.boundingBox(), actions.boundingBox(), inspector.boundingBox()])
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    expect(inspectorBox).not.toBeNull()
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(1)
    expect((after?.x ?? 0) + (after?.width ?? 0)).toBeLessThanOrEqual((actionsBox?.x ?? 0) + (actionsBox?.width ?? 0))
    expect((actionsBox?.x ?? 0) + (actionsBox?.width ?? 0)).toBeLessThanOrEqual(inspectorBox?.x ?? 0)
    expect((after?.x ?? 0) + (after?.width ?? 0)).toBeLessThan(inspectorBox?.x ?? 0)
  })

  test('mantém streaming e diffs extensos com DOM limitado', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.evaluate(() => {
      const bridge = (window as unknown as { __nocturneTest: { emitEvent(payload: unknown): void } }).__nocturneTest
      bridge.emitEvent({ method: 'item/agentMessage/delta', params: { delta: '# Resposta em andamento\n' + 'texto '.repeat(20_000) } })
      bridge.emitEvent({ method: 'turn/diff/updated', params: { diff: '+linha alterada\n'.repeat(30_000) } })
    })
    await expect(page.locator('.streaming-response')).toHaveCount(1)
    await expect(page.locator('.streaming-response').locator('h1')).toHaveCount(0)
    const proposed = page.getByText('Alterações propostas', { exact: true })
    await expect(proposed).toBeVisible()
    await expect(page.locator('.diff-panel')).toHaveCount(0)
    await proposed.click()
    await expect(page.locator('.diff-panel pre')).toHaveCount(1)
    expect(await page.locator('.diff-panel pre').textContent()).toHaveLength(300_000)
    await expect(page.locator('.diff-panel pre span')).toHaveCount(0)
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

  test('mantém a navegação das configurações estável no hover', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.getByRole('button', { name: 'Abrir configurações' }).last().click()
    const dialog = page.getByRole('dialog', { name: 'Configurações' })
    const navigation = dialog.getByRole('navigation', { name: 'Seções das configurações' })
    const codex = navigation.getByRole('button', { name: /Codex/ })
    const workspaces = navigation.getByRole('button', { name: /Workspaces/ })
    const before = await Promise.all([codex.boundingBox(), workspaces.boundingBox()])
    await workspaces.hover()
    await page.waitForTimeout(180)
    const after = await Promise.all([codex.boundingBox(), workspaces.boundingBox()])
    expect(before.every(Boolean) && after.every(Boolean)).toBe(true)
    expect(after.map((box) => ({ width: box?.width, height: box?.height }))).toEqual(
      before.map((box) => ({ width: box?.width, height: box?.height })),
    )
    expect((after[1]?.y ?? 0) - (after[0]?.y ?? 0)).toBe((before[1]?.y ?? 0) - (before[0]?.y ?? 0))
    await expect(workspaces).toHaveCSS('transform', 'none')
    await codex.hover(); await workspaces.hover(); await codex.hover(); await workspaces.hover()
    await expect(workspaces).toHaveCSS('transform', 'none')
    await page.waitForTimeout(240)
    await expect(dialog.getByText('Codex pronto')).toBeVisible()
    await dialog.evaluate((element) => {
      element.scrollTo(0, 0)
      element.querySelectorAll<HTMLElement>('*').forEach((child) => child.scrollTo(0, 0))
    })
    await expect(dialog).toHaveScreenshot('settings-dialog.png', { animations: 'disabled', caret: 'hide' })
  })

  test('mantém o controle de logs detalhados estável no hover e no clique', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.getByRole('button', { name: 'Abrir configurações' }).last().click()
    const dialog = page.getByRole('dialog', { name: 'Configurações' })
    await dialog.getByRole('button', { name: /Aplicativo/ }).click()
    const checkbox = dialog.getByRole('checkbox', { name: /Logs detalhados/ })
    const card = checkbox.locator('..')
    const before = await card.boundingBox()
    await card.hover(); await checkbox.hover(); await card.hover(); await checkbox.hover()
    await page.waitForTimeout(240)
    const afterHover = await card.boundingBox()
    expect(before).not.toBeNull()
    expect(afterHover).toMatchObject({ width: before?.width, height: before?.height })
    await expect(card).toHaveCSS('transform', 'none')
    await expect(checkbox).toHaveCSS('appearance', 'none')
    await expect(checkbox).toHaveCSS('width', '18px')
    await checkbox.click()
    await expect(checkbox).toBeChecked()
    const afterClick = await card.boundingBox()
    expect(afterClick).toMatchObject({ width: before?.width, height: before?.height })
  })

  test('trunca nomes e caminhos longos sem atravessar os limites da interface', async ({ page }) => {
    await page.setViewportSize({ width: 980, height: 820 })
    await ready(page)
    await page.locator('.title-block h1').evaluate((element) => { element.textContent = 'LimpadorEAnalisadorDeArmazenamentoComUmNomeExtremamenteLongo' })
    await page.locator('.path-pill span').evaluate((element) => { element.textContent = 'LimpadorEAnalisadorDeArmazenamentoComUmNomeExtremamenteLongo' })
    const titleBlock = page.locator('.title-block')
    const actions = page.locator('.top-actions')
    const titleBox = await titleBlock.boundingBox()
    const actionsBox = await actions.boundingBox()
    expect(titleBox).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    expect((titleBox?.x ?? 0) + (titleBox?.width ?? 0)).toBeLessThanOrEqual(actionsBox?.x ?? 0)

    await page.getByRole('button', { name: 'Abrir configurações' }).last().click()
    const dialog = page.getByRole('dialog', { name: 'Configurações' })
    await dialog.getByRole('button', { name: /Workspaces/ }).click()
    const card = dialog.locator('.settings-workspaces > div').first()
    const name = card.locator('strong')
    const path = card.locator('small')
    await name.evaluate((element) => { element.textContent = 'LimpadorEAnalisadorDeArmazenamentoComUmNomeExtremamenteLongo' })
    await path.evaluate((element) => { element.textContent = '/home/usuario/Documentos/Projetos/LimpadorEAnalisadorDeArmazenamentoComUmNomeExtremamenteLongo' })
    await expect(name).toHaveCSS('text-overflow', 'ellipsis')
    await expect(path).toHaveCSS('text-overflow', 'ellipsis')
    const [cardBox, nameBox, pathBox] = await Promise.all([card.boundingBox(), name.boundingBox(), path.boundingBox()])
    expect(cardBox).not.toBeNull()
    expect((nameBox?.x ?? 0) + (nameBox?.width ?? 0)).toBeLessThanOrEqual((cardBox?.x ?? 0) + (cardBox?.width ?? 0))
    expect((pathBox?.x ?? 0) + (pathBox?.width ?? 0)).toBeLessThanOrEqual((cardBox?.x ?? 0) + (cardBox?.width ?? 0))
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

  test('gerencia Providers com credencial transitória e estados explícitos', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.getByRole('button', { name: 'Abrir configurações' }).last().click()
    const dialog = page.getByRole('dialog', { name: 'Configurações' })
    await dialog.getByRole('button', { name: /Providers/ }).click()
    await expect(dialog.getByText('Nenhum Provider configurado')).toBeVisible()
    await dialog.getByRole('button', { name: 'Adicionar primeiro Provider' }).click()

    await dialog.getByRole('textbox', { name: 'Nome' }).fill('OpenRouter pessoal')
    const secret = dialog.getByRole('textbox', { name: 'Credencial', exact: true })
    await secret.fill('temporary-renderer-secret')
    const secretSurface = secret.locator('..')
    await expect(secret).toHaveCSS('border-top-width', '0px')
    await expect(secret).toHaveCSS('box-shadow', 'none')
    await expect(secretSurface).toHaveCSS('border-top-color', 'rgb(155, 124, 246)')
    await expect(dialog.getByRole('button', { name: /Codex/ })).toBeDisabled()
    await dialog.getByRole('button', { name: 'Salvar draft' }).click()

    const card = dialog.locator('.provider-card')
    await expect(card).toContainText('OpenRouter pessoal')
    await expect(card).toContainText('Credencial protegida')
    await expect(card).toContainText('Desabilitado')
    await card.getByRole('button', { name: 'Editar OpenRouter pessoal' }).click()
    await dialog.getByRole('checkbox', { name: /Habilitar agora/ }).check()
    await dialog.getByRole('button', { name: 'Validar e salvar' }).click()
    await card.getByRole('button', { name: 'Testar OpenRouter pessoal' }).click()
    await expect(card).toContainText('Disponível')
    await expect(dialog).toHaveScreenshot('provider-settings.png', { animations: 'disabled', caret: 'hide' })

    await card.getByRole('button', { name: 'Remover OpenRouter pessoal' }).click()
    await expect(card.getByRole('alert')).toContainText('Remover?')
    await card.getByRole('button', { name: 'Confirmar' }).click()
    await expect(dialog.getByText('Nenhum Provider configurado')).toBeVisible()
  })

  test('protege um formulário de Provider ainda não salvo', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 800 })
    await ready(page)
    await page.getByRole('button', { name: 'Abrir configurações' }).last().click()
    const dialog = page.getByRole('dialog', { name: 'Configurações' })
    await dialog.getByRole('button', { name: /Providers/ }).click()
    await dialog.getByRole('button', { name: 'Adicionar primeiro Provider' }).click()
    await dialog.getByRole('textbox', { name: 'Nome' }).fill('Provider em edição')
    await page.keyboard.press('Escape')
    await expect(dialog.getByRole('alert')).toContainText('Descartar alterações?')
    await dialog.getByRole('button', { name: 'Continuar editando' }).click()
    await expect(dialog.getByRole('textbox', { name: 'Nome' })).toHaveValue('Provider em edição')
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

  test('gerencia o ciclo explícito das memórias do Segundo Cérebro', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 850 })
    await ready(page)
    await page.getByRole('button', { name: 'Memória do workspace' }).click()
    await page.getByRole('button', { name: 'Abrir Segundo Cérebro' }).click()
    const brain = page.getByRole('dialog', { name: 'Segundo Cérebro' })
    await expect(brain).toBeVisible()
    await brain.getByLabel('Tipo').selectOption('decision')
    await brain.getByLabel('Conteúdo').fill('SQLite permanece como fonte de verdade local.')
    await brain.getByRole('button', { name: 'Adicionar para revisão' }).click()
    await expect(brain.getByText('SQLite permanece como fonte de verdade local.')).toBeVisible()
    await brain.getByRole('button', { name: 'Aprovar' }).click()
    await expect(brain.getByRole('button', { name: 'Desatualizar' })).toBeVisible()
    await brain.getByLabel('Buscar memórias').fill('SQLite')
    await brain.getByRole('button', { name: 'Buscar' }).click()
    await expect(brain.locator('.brain-card')).toHaveCount(1)
    await brain.getByRole('button', { name: 'Editar memória' }).click()
    await brain.getByLabel('Editar memória').fill('SQLite continua como fonte de verdade local e recuperável.')
    await brain.getByRole('button', { name: 'Salvar edição' }).click()
    await expect(brain.getByText('SQLite continua como fonte de verdade local e recuperável.')).toBeVisible()
    await brain.getByRole('button', { name: 'Arquivar' }).click()
    await brain.getByRole('button', { name: 'Excluir' }).click()
    await brain.getByRole('button', { name: 'Confirmar exclusão' }).click()
    await expect(brain.getByText('Nenhuma correspondência')).toBeVisible()
  })

  test('transforma propostas do agente somente em candidatas revisáveis', async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 850 })
    await ready(page)
    await page.evaluate(() => { window.nocturne.codex.send = async () => ({ threadId: 'thread-1', recreated: false }) })
    await page.getByLabel('Mensagem para o Codex').fill('Registre um aprendizado durável.')
    await page.getByRole('button', { name: 'Enviar mensagem' }).click()
    await page.evaluate(() => {
      const bridge = (window as unknown as { __nocturneTest: { emitEvent(payload: unknown): void; emitStatus(payload: unknown): void } }).__nocturneTest
      const block = `Resposta sem metadados visíveis.\n\n\`\`\`nocturne-memories\n${JSON.stringify([{ kind: 'learning', scope: 'workspace', content: 'Validar restaurações antes de substituir dados locais.', confidence: 85 }])}\n\`\`\``
      bridge.emitStatus({ status: 'streaming' })
      bridge.emitEvent({ method: 'item/agentMessage/delta', params: { delta: block } })
      bridge.emitEvent({ method: 'turn/completed', params: { turn: { id: 'turn-memory' }, threadId: 'thread-1' } })
    })
    await expect(page.getByText('Resposta sem metadados visíveis.')).toBeVisible()
    await expect(page.getByText('nocturne-memories')).toHaveCount(0)
    await page.getByRole('button', { name: 'Memória do workspace' }).click()
    await page.getByRole('button', { name: 'Abrir Segundo Cérebro' }).click()
    const brain = page.getByRole('dialog', { name: 'Segundo Cérebro' })
    await expect(brain.getByText('Validar restaurações antes de substituir dados locais.')).toBeVisible()
    await expect(brain.locator('.brain-card').getByText('Candidata', { exact: true })).toBeVisible()
    await expect(brain.getByRole('button', { name: 'Aprovar' })).toBeVisible()
  })

  test('mantém o Segundo Cérebro alinhado em desktop e mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.evaluate(async () => {
      const active = await window.nocturne.brain.create('conversation-1', { kind: 'decision', scope: 'workspace', content: 'SQLite permanece como fonte de verdade local e recuperável.' })
      await window.nocturne.brain.update('conversation-1', active.id, { status: 'active', confidence: 94 })
      const outdated = await window.nocturne.brain.create('conversation-1', { kind: 'preference', scope: 'conversation', content: 'Usar uma preferência temporária de interface nesta conversa.' })
      await window.nocturne.brain.update('conversation-1', outdated.id, { status: 'outdated', confidence: 62 })
      await window.nocturne.brain.extract('conversation-1', `\`\`\`nocturne-memories\n${JSON.stringify([{ kind: 'learning', scope: 'workspace', content: 'Validar restaurações antes de substituir dados locais.', confidence: 86 }])}\n\`\`\``)
    })
    await page.getByRole('button', { name: 'Memória do workspace' }).click()
    await page.getByRole('button', { name: 'Abrir Segundo Cérebro' }).click()
    const brain = page.getByRole('dialog', { name: 'Segundo Cérebro' })
    await expect(brain.locator('.brain-card')).toHaveCount(3)
    const [brainBox, createActionBox] = await Promise.all([
      brain.boundingBox(),
      brain.getByRole('button', { name: 'Adicionar para revisão' }).boundingBox(),
    ])
    expect(brainBox).not.toBeNull()
    expect(createActionBox).not.toBeNull()
    expect((createActionBox?.y ?? 0) + (createActionBox?.height ?? 0)).toBeLessThanOrEqual((brainBox?.y ?? 0) + (brainBox?.height ?? 0))
    const searchField = brain.locator('.brain-search > label')
    const searchAction = brain.getByRole('button', { name: 'Buscar' })
    const statusFilter = brain.getByLabel('Filtrar estado')
    const [searchFieldBox, searchActionBox, statusFilterBox] = await Promise.all([
      searchField.boundingBox(), searchAction.boundingBox(), statusFilter.boundingBox(),
    ])
    expect(searchFieldBox).not.toBeNull()
    expect(searchActionBox).not.toBeNull()
    expect(statusFilterBox).not.toBeNull()
    expect(Math.abs((searchFieldBox?.y ?? 0) - (searchActionBox?.y ?? 0))).toBeLessThan(1)
    expect(Math.abs((searchFieldBox?.y ?? 0) - (statusFilterBox?.y ?? 0))).toBeLessThan(1)
    expect(searchFieldBox?.height).toBe(searchActionBox?.height)
    expect(searchFieldBox?.height).toBe(statusFilterBox?.height)
    await statusFilter.focus()
    await expect(statusFilter).toHaveCSS('outline-style', 'none')
    await expect(statusFilter).toHaveCSS('box-shadow', 'none')
    await expect(brain).toHaveScreenshot('second-brain-dialog.png', { animations: 'disabled', caret: 'hide' })

    await page.setViewportSize({ width: 520, height: 760 })
    await expect(brain.getByRole('tab', { name: 'Biblioteca' })).toHaveAttribute('aria-selected', 'true')
    await expect(brain).toHaveScreenshot('second-brain-dialog-mobile.png', { animations: 'disabled', caret: 'hide' })
    await brain.getByRole('tab', { name: 'Criar memória' }).click()
    const contentField = brain.getByLabel('Conteúdo')
    await contentField.focus()
    await expect(contentField).toHaveCSS('outline-style', 'none')
    await expect(contentField).toHaveCSS('box-shadow', 'none')
    await expect(brain).toHaveScreenshot('second-brain-create-mobile.png', { animations: 'disabled', caret: 'hide' })
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
      window.nocturne.suggestions.page = async () => ({ items: [{
        id: 'suggestion-1', workspaceId: 'workspace-1', conversationId: 'conversation-1', title: 'Melhorar feedback', description: 'Problema', reasoning: 'Evidência', category: 'accessibility', severity: 'medium', affectedFiles: ['src/App.tsx'], proposedChanges: '+ feedback', expectedBenefits: ['Mais confiança'], complexity: 'low', risk: 'low', status: 'pending', createdAt: '2026-07-13T20:00:00.000Z', updatedAt: '2026-07-13T20:00:00.000Z',
      }], hasMore: false })
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

  test('não inicia Build quando a aceitação da sugestão não pode ser persistida', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.evaluate(() => {
      const suggestion: Suggestion = {
        id: 'suggestion-persistence', workspaceId: '/workspace/nocturne-codex', conversationId: 'conversation-1', title: 'Persistir antes de aplicar', description: 'A decisão precisa ser durável.', reasoning: 'O fluxo de aprovação depende do registro local.', category: 'bug', severity: 'high', affectedFiles: ['src/App.tsx'], proposedChanges: '+ correção', expectedBenefits: ['Auditoria consistente'], complexity: 'low', risk: 'low', status: 'pending', createdAt: '2026-07-13T20:00:00.000Z', updatedAt: '2026-07-13T20:00:00.000Z',
      }
      window.nocturne.suggestions.page = async () => ({ items: [suggestion], hasMore: false })
      window.nocturne.suggestions.status = async () => { throw new Error('Falha ao persistir decisão.') }
      Object.defineProperty(window, '__suggestionSendCount', { configurable: true, writable: true, value: 0 })
      window.nocturne.codex.send = async () => { (window as unknown as { __suggestionSendCount: number }).__suggestionSendCount += 1; return { threadId: 'thread-1', recreated: false } }
    })
    await page.locator('.conversation-open').click()
    await page.getByRole('tab', { name: /Sugestões/ }).click()
    await page.getByRole('button', { name: 'Aplicar' }).click()
    await page.getByRole('button', { name: 'Preparar aplicação' }).click()
    await expect(page.getByRole('alert')).toContainText('A sugestão não foi aceita: Falha ao persistir decisão.')
    expect(await page.evaluate(() => (window as unknown as { __suggestionSendCount: number }).__suggestionSendCount)).toBe(0)
  })

  test('recalcula a Saúde do Projeto quando uma sugestão é aplicada', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await ready(page)
    await page.evaluate(() => {
      const common = { workspaceId: '/workspace/nocturne-codex', conversationId: 'conversation-1', description: 'A arquitetura precisa de uma fronteira mais clara.', reasoning: 'Responsabilidades observadas no mesmo módulo.', category: 'architecture' as const, affectedFiles: ['src/App.tsx'], proposedChanges: '+ extrair responsabilidade', expectedBenefits: ['Arquitetura mais clara'], complexity: 'low' as const, risk: 'low' as const, status: 'pending' as const, createdAt: '2026-07-13T20:00:00.000Z', updatedAt: '2026-07-13T20:00:00.000Z' }
      const suggestions: Suggestion[] = [
        { ...common, id: 'suggestion-live-health', title: 'Refinar fronteiras', severity: 'medium' },
        { ...common, id: 'suggestion-remaining', title: 'Separar domínio restante', severity: 'high' },
      ]
      window.nocturne.suggestions.page = async () => ({ items: suggestions.map((suggestion) => ({ ...suggestion })), hasMore: false })
      window.nocturne.suggestions.status = async (_conversationId, suggestionId, status) => {
        const suggestion = suggestions.find((item) => item.id === suggestionId)
        if (!suggestion) throw new Error('Sugestão não encontrada.')
        suggestion.status = status; suggestion.updatedAt = '2026-07-13T20:05:00.000Z'
        return { ...suggestion }
      }
      window.nocturne.codex.send = async () => ({ threadId: 'thread-1', recreated: false })
    })
    await page.locator('.conversation-open').click()
    await page.getByRole('tab', { name: /Sugestões/ }).click()
    const architecture = page.locator('.health-metric').filter({ hasText: 'Arquitetura' })
    await expect(architecture.getByText('7/10', { exact: true })).toBeVisible()
    await page.locator('.suggestion-card').filter({ hasText: 'Refinar fronteiras' }).getByRole('button', { name: 'Aplicar' }).click()
    await page.getByRole('button', { name: 'Preparar aplicação' }).click()
    await expect(architecture.getByText('7/10', { exact: true })).toBeVisible()
    await page.evaluate(() => {
      const bridge = (window as unknown as { __nocturneTest: { emitEvent(payload: unknown): void } }).__nocturneTest
      bridge.emitEvent({ method: 'item/completed', params: { item: { id: 'file-change-health', type: 'fileChange', status: 'completed', changes: [{ path: 'src/App.tsx', kind: 'modified', status: 'completed' }] } } })
      bridge.emitEvent({ method: 'turn/completed', params: { turn: { id: 'turn-live-health' }, threadId: 'thread-1' } })
    })
    const healthCard = page.locator('.health-card')
    await expect(healthCard.locator('.sr-only[role="status"]')).toContainText('Arquitetura passou de 7 para 8')
    await expect(architecture).toHaveClass(/improved/)
    await expect(architecture.locator('.health-score s')).toHaveText('7/10')
    await expect(architecture.locator('.health-score strong')).toHaveText('8/10')
    await expect(page.locator('#agent-inspector')).toHaveScreenshot('project-health-updated.png', { animations: 'disabled', caret: 'hide' })
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

test('mantém o histórico isolado até reautorizar um workspace restaurado', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-13T20:05:00.000Z'))
  await installNocturneMock(page, { unauthorized: true })
  await page.setViewportSize({ width: 1180, height: 850 })
  await ready(page)
  await expect(page.getByText('Reautorizar workspace?')).toBeVisible()
  const before = await page.evaluate(() => (window as unknown as { __nocturneTest: { calls(): { memoryReads: number; resumes: number } } }).__nocturneTest.calls())
  expect(before).toMatchObject({ memoryReads: 0, resumes: 0 })
  await page.getByRole('button', { name: 'Selecionar pasta' }).click()
  await expect(page.getByText('Reautorizar workspace?')).toBeHidden()
  await expect.poll(() => page.evaluate(() => (window as unknown as { __nocturneTest: { calls(): { selectedExpected?: string; memoryReads: number; resumes: number } } }).__nocturneTest.calls())).toEqual({ selectedExpected: '/workspace/nocturne-codex', memoryReads: 1, resumes: 1 })
})
