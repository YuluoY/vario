/**
 * Action VM 执行器
 * 
 * 功能：
 * - 执行动作序列
 * - 通过 $methods 查找动作处理器
 * - 错误处理和堆栈跟踪
 * - 超时保护（防止无限循环）
 * 
 * 参考架构图：vario-core/vm - Action VM
 */

import type { RuntimeContext, Action } from '../types.js'
import { ActionError, ServiceError, ErrorCodes } from '../errors.js'

/**
 * 执行动作序列的选项
 */
export interface ExecuteOptions {
  /**
   * 超时时间（毫秒），默认 5000ms
   */
  timeout?: number
  /**
   * 最大执行步数，默认 10000
   * 每执行一个动作计为一步
   */
  maxSteps?: number
}

/**
 * 执行动作序列
 * 
 * @param actions 动作数组
 * @param ctx 运行时上下文
 * @param options 执行选项
 */
export async function execute(
  actions: Action[],
  ctx: RuntimeContext,
  options: ExecuteOptions = {}
): Promise<void> {
  const timeout = options.timeout ?? 5000
  const maxSteps = options.maxSteps ?? 10000
  const startTime = Date.now()
  let stepCount = 0
  
  // 创建 AbortController 用于超时中断（如果支持）
  let abortController: AbortController | null = null
  if (typeof AbortController !== 'undefined') {
    abortController = new AbortController()
    
    // 设置超时定时器
    const timeoutId = setTimeout(() => {
      abortController?.abort()
    }, timeout)
    
    // 清理定时器（如果执行完成）
    const cleanup = () => clearTimeout(timeoutId)
    
    try {
      await executeActions(actions, ctx, abortController.signal, maxSteps, () => {
        stepCount++
        if (stepCount > maxSteps) {
          throw new ActionError(
            actions[actions.length - 1] || { type: 'unknown' } as Action,
            `Action execution exceeded max steps (${maxSteps})`,
            ErrorCodes.ACTION_MAX_STEPS_EXCEEDED,
            {
              metadata: {
                maxSteps,
                currentSteps: stepCount
              }
            }
          )
        }
        // 检查超时
        if (Date.now() - startTime > timeout) {
          throw new ActionError(
            actions[actions.length - 1] || { type: 'unknown' } as Action,
            `Action execution exceeded timeout (${timeout}ms)`,
            ErrorCodes.ACTION_TIMEOUT,
            {
              metadata: {
                timeout,
                elapsedTime: Date.now() - startTime
              }
            }
          )
        }
      })
      cleanup()
    } catch (error) {
      cleanup()
      throw error
    }
  } else {
    // 不支持 AbortController 的环境，使用时间检查
    await executeActions(actions, ctx, null, maxSteps, () => {
      stepCount++
      if (stepCount > maxSteps) {
        throw new ActionError(
          actions[actions.length - 1] || { type: 'unknown' } as Action,
          `Action execution exceeded max steps (${maxSteps})`,
          ErrorCodes.ACTION_MAX_STEPS_EXCEEDED,
          {
            metadata: {
              maxSteps,
              currentSteps: stepCount
            }
          }
        )
      }
      // 检查超时
      if (Date.now() - startTime > timeout) {
        throw new ActionError(
          actions[actions.length - 1] || { type: 'unknown' } as Action,
          `Action execution exceeded timeout (${timeout}ms)`,
          ErrorCodes.ACTION_TIMEOUT,
          {
            metadata: {
              timeout,
              elapsedTime: Date.now() - startTime
            }
          }
        )
      }
    })
  }
  
  // 最终检查超时（即使有 AbortController，也做双重检查）
  if (Date.now() - startTime > timeout) {
    throw new ActionError(
      actions[actions.length - 1] || { type: 'unknown' } as Action,
      `Action execution exceeded timeout (${timeout}ms)`,
      ErrorCodes.ACTION_TIMEOUT,
      {
        metadata: {
          timeout,
          elapsedTime: Date.now() - startTime,
          actionCount: actions.length
        }
      }
    )
  }
}

/**
 * 执行动作序列（内部实现）
 */
async function executeActions(
  actions: Action[],
  ctx: RuntimeContext,
  signal: AbortSignal | null,
  _maxSteps: number,  // 用于类型，实际限制在 checkLimits 中检查
  checkLimits: () => void
): Promise<void> {
  for (const action of actions) {
    // 检查中断信号
    if (signal?.aborted) {
      throw new ActionError(
        action,
        'Action execution was aborted',
        ErrorCodes.ACTION_ABORTED
      )
    }
    
    // 检查步数和超时限制
    checkLimits()
    
    // 所有动作（包括内置动作）统一通过 $methods 注册
    const handler = ctx.$methods[action.type]
    
    if (!handler) {
      throw new ActionError(
        action,
        `Unknown action type: ${action.type}. Make sure the action is registered in $methods`,
        ErrorCodes.ACTION_UNKNOWN_TYPE
      )
    }
    
    try {
      await handler(ctx, action)
    } catch (error: unknown) {
      // 如果已经是 ActionError，直接抛出
      if (error instanceof ActionError) {
        throw error
      }
      
      // 如果已经是 ServiceError，直接抛出
      if (error instanceof ServiceError) {
        throw error
      }
      
      // 包装为 ActionError，收集上下文信息
      const errorMessage = error instanceof Error ? error.message : String(error)
      throw new ActionError(
        action,
        `Action execution failed: ${errorMessage}`,
        ErrorCodes.ACTION_EXECUTION_ERROR,
        {
          metadata: {
            originalError: error instanceof Error ? error.name : 'Unknown',
            stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
          }
        }
      )
    }
  }
}
