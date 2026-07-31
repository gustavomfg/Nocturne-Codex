export interface ProductErrorExplanation {
  title: string
  cause: string
  preserved: string
  resolution: string
  retryable: boolean
}

export function explainProductError(message: string): ProductErrorExplanation {
  const normalized = message.toLocaleLowerCase()
  const preserved = 'A conversa e os dados já salvos foram preservados. A operação incompleta não foi marcada como concluída.'
  if (/insufficient_quota|quota exceeded|sem cr[eé]ditos|cr[eé]ditos insuficientes|billing/.test(normalized)) {
    return { title: 'Créditos insuficientes na API', cause: message, preserved, resolution: 'Adicione créditos à conta da API ou selecione a conta ChatGPT ou outro Provider configurado.', retryable: false }
  }
  if (/unauthorized|not authenticated|n[aã]o autenticad|login|api.?key|chave.*inv[aá]lid|401/.test(normalized)) {
    return { title: 'Autenticação necessária', cause: message, preserved, resolution: 'Abra Configurações → IA, autentique novamente ou revise a credencial do Provider.', retryable: false }
  }
  if (/rate.?limit|muitas solicita|429/.test(normalized)) {
    return { title: 'Limite temporário do Provider', cause: message, preserved, resolution: 'Aguarde o intervalo indicado pelo Provider e tente novamente.', retryable: true }
  }
  if (/timeout|tempo permitido|excedeu o tempo/.test(normalized)) {
    return { title: 'A operação excedeu o tempo limite', cause: message, preserved, resolution: 'Verifique se o serviço está respondendo e tente novamente. Se persistir, abra o diagnóstico.', retryable: true }
  }
  if (/econn|network|fetch failed|dns|offline|conex[aã]o|inacess[ií]vel/.test(normalized)) {
    return { title: 'Não foi possível alcançar o serviço', cause: message, preserved, resolution: 'Confira a rede e o endereço do Provider, execute o diagnóstico da conexão e tente novamente.', retryable: true }
  }
  if (/workspace|pasta do projeto|permiss|n[aã]o autorizad|fora do projeto/.test(normalized)) {
    return { title: 'O workspace precisa de atenção', cause: message, preserved, resolution: 'Reabra ou reautorize a pasta correta e repita a operação.', retryable: false }
  }
  if (/banco|database|sqlite|migra|corromp|restaur/.test(normalized)) {
    return { title: 'A persistência local não pôde concluir a operação', cause: message, preserved: 'O Studio interrompeu a operação para evitar uma gravação parcial. Os dados anteriores foram preservados ou mantidos no ponto de recuperação informado.', resolution: 'Abra Diagnóstico, preserve os arquivos locais e use a recuperação ou um backup verificado.', retryable: false }
  }
  return { title: 'A operação não foi concluída', cause: message || 'O aplicativo não recebeu detalhes adicionais da falha.', preserved, resolution: 'Tente novamente. Se a falha persistir, exporte o diagnóstico sanitizado em Configurações → Diagnóstico.', retryable: true }
}
