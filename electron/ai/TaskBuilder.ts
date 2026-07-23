import { randomUUID } from 'node:crypto'
import type { NormalizedTask } from '../../shared/ai/task'
import {
  normalizedTaskInputSchema,
  normalizedTaskSchema,
} from '../../shared/ai/taskSchemas'

export class TaskBuilderError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
    this.name = 'TaskBuilderError'
  }
}

export class TaskBuilder {
  constructor(
    private readonly createId: () => string = randomUUID,
    private readonly now: () => Date = () => new Date(),
  ) {}

  build(input: unknown): NormalizedTask {
    const parsed = normalizedTaskInputSchema.safeParse(input)
    if (!parsed.success) {
      throw new TaskBuilderError('Não foi possível construir a tarefa normalizada.', parsed.error)
    }

    const task = normalizedTaskSchema.safeParse({
      id: this.createId(),
      createdAt: this.now().toISOString(),
      ...parsed.data,
    })
    if (!task.success) {
      throw new TaskBuilderError('A identidade da tarefa normalizada é inválida.', task.error)
    }
    return task.data as NormalizedTask
  }
}
