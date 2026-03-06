import { Elysia, t } from 'elysia'
import { CreativeWorkflowService } from '../services/CreativeWorkflowService'
import { resolveOrganizationContext } from './context'
import { resolveErrorMessage } from './errors'

export const v4CreativeRoutes = () =>
  new Elysia()
    .get(
      '/api/v4/creative/prompt-workflows',
      ({ query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          workflows: CreativeWorkflowService.listPromptWorkflows(
            organizationContext.organizationId,
            Number.parseInt(query.limit || '50', 10)
          )
        }
      },
      {
        query: t.Object({
          limit: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/creative/prompt-workflows',
      ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            workflow: CreativeWorkflowService.createPromptWorkflow({
              organizationId: organizationContext.organizationId,
              name: body.name,
              description: body.description,
              definition: body.definition,
              createdBy: body.createdBy || organizationContext.user.id
            })
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '工作流创建失败')
          }
        }
      },
      {
        body: t.Object({
          name: t.String(),
          description: t.Optional(t.String()),
          definition: t.Optional(t.Record(t.String(), t.Any())),
          createdBy: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/v4/creative/prompt-workflows/:workflowId/runs',
      ({ params, query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const result = CreativeWorkflowService.listPromptWorkflowRuns({
            organizationId: organizationContext.organizationId,
            workflowId: params.workflowId,
            limit: Number.parseInt(query.limit || '20', 10),
            cursor: query.cursor
          })
          return {
            success: true,
            runs: result.runs,
            page: result.page
          }
        } catch (error: unknown) {
          const message = resolveErrorMessage(error, '')
          if (message.includes('不存在')) {
            set.status = 404
          } else if (message.includes('无权')) {
            set.status = 403
          } else {
            set.status = 400
          }
          return { success: false, status: 'error', error: message || '工作流运行记录查询失败' }
        }
      },
      {
        params: t.Object({
          workflowId: t.String()
        }),
        query: t.Object({
          limit: t.Optional(t.String()),
          cursor: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/creative/prompt-workflows/:workflowId/run',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            run: CreativeWorkflowService.runPromptWorkflow(params.workflowId, {
              organizationId: organizationContext.organizationId,
              triggerType: body.triggerType,
              input: body.input,
              createdBy: body.createdBy || organizationContext.user.id
            })
          }
        } catch (error: unknown) {
          const message = resolveErrorMessage(error, '')
          if (message.includes('不存在')) {
            set.status = 404
          } else {
            set.status = 400
          }
          return { success: false, status: 'error', error: message || '工作流执行失败' }
        }
      },
      {
        params: t.Object({
          workflowId: t.String()
        }),
        body: t.Object({
          triggerType: t.Optional(t.String()),
          input: t.Optional(t.Record(t.String(), t.Any())),
          createdBy: t.Optional(t.String())
        })
      }
    )
    .post(
      '/api/v4/creative/batch-jobs',
      ({ body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            job: CreativeWorkflowService.createBatchJob({
              organizationId: organizationContext.organizationId,
              workflowRunId: body.workflowRunId,
              jobType: body.jobType,
              payload: body.payload,
              items: body.items,
              createdBy: body.createdBy || organizationContext.user.id
            })
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '批处理任务创建失败')
          }
        }
      },
      {
        body: t.Object({
          workflowRunId: t.Optional(t.String()),
          jobType: t.String(),
          payload: t.Optional(t.Record(t.String(), t.Any())),
          items: t.Optional(
            t.Array(
              t.Object({
                itemKey: t.Optional(t.String()),
                input: t.Optional(t.Record(t.String(), t.Any()))
              })
            )
          ),
          createdBy: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/v4/creative/batch-jobs',
      ({ query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          const pageResult = CreativeWorkflowService.listBatchJobs({
            organizationId: organizationContext.organizationId,
            workflowRunId: query.workflowRunId,
            jobType: query.jobType,
            status: query.status as 'queued' | 'completed' | 'failed' | undefined,
            limit: Number.parseInt(query.limit || '20', 10),
            cursor: query.cursor
          })
          return {
            success: true,
            jobs: pageResult.jobs,
            page: pageResult.page
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '批处理任务查询失败')
          }
        }
      },
      {
        query: t.Object({
          workflowRunId: t.Optional(t.String()),
          jobType: t.Optional(t.String()),
          status: t.Optional(
            t.Union([t.Literal('queued'), t.Literal('completed'), t.Literal('failed')])
          ),
          limit: t.Optional(t.String()),
          cursor: t.Optional(t.String())
        })
      }
    )
    .get(
      '/api/v4/creative/batch-jobs/:jobId',
      ({ params, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        const job = CreativeWorkflowService.getBatchJob(params.jobId)
        if (!job) {
          set.status = 404
          return { success: false, status: 'error', error: 'Batch job not found' }
        }
        if (job.organizationId !== organizationContext.organizationId) {
          set.status = 403
          return { success: false, status: 'error', error: 'Forbidden' }
        }
        return { success: true, job }
      },
      {
        params: t.Object({
          jobId: t.String()
        })
      }
    )
    .post(
      '/api/v4/assets/:assetId/reuse',
      ({ params, body, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        try {
          return {
            success: true,
            record: CreativeWorkflowService.recordAssetReuse({
              organizationId: organizationContext.organizationId,
              assetId: params.assetId,
              sourceProjectId: body.sourceProjectId,
              targetProjectId: body.targetProjectId,
              reusedBy: body.reusedBy || organizationContext.user.id,
              context: body.context
            })
          }
        } catch (error: unknown) {
          set.status = 400
          return {
            success: false,
            status: 'error',
            error: resolveErrorMessage(error, '资产复用记录创建失败')
          }
        }
      },
      {
        params: t.Object({
          assetId: t.String()
        }),
        body: t.Object({
          sourceProjectId: t.Optional(t.String()),
          targetProjectId: t.Optional(t.String()),
          reusedBy: t.Optional(t.String()),
          context: t.Optional(t.Record(t.String(), t.Any()))
        })
      }
    )
    .get(
      '/api/v4/assets/reuse-history',
      ({ query, request, set }) => {
        const organizationContext = resolveOrganizationContext(request, set, 'member')
        if (!organizationContext) return { success: false, status: 'error', error: 'Forbidden' }
        return {
          success: true,
          records: CreativeWorkflowService.listAssetReuseHistory({
            organizationId: organizationContext.organizationId,
            assetId: query.assetId,
            sourceProjectId: query.sourceProjectId,
            targetProjectId: query.targetProjectId,
            limit: Number.parseInt(query.limit || '50', 10),
            offset: Number.parseInt(query.offset || '0', 10)
          })
        }
      },
      {
        query: t.Object({
          assetId: t.Optional(t.String()),
          sourceProjectId: t.Optional(t.String()),
          targetProjectId: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String())
        })
      }
    )
