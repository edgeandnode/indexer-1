import axios, { AxiosInstance } from 'axios'
import { logging } from '@graphprotocol/common-ts'
import { delay } from '@connext/utils'
import EventEmitter from 'eventemitter3'

export interface IndexingSubgraphMonitorOptions {
  logger: logging.Logger
  graphNode: string
}

export type IndexingSubgraphMonitorEvents = 'updated'

export class IndexingSubgraphMonitor extends EventEmitter<IndexingSubgraphMonitorEvents> {
  subgraphs: string[]

  constructor(options: IndexingSubgraphMonitorOptions) {
    super()
    this.subgraphs = []
    this.periodicallySyncIndexingSubgraphs(options)
  }

  async periodicallySyncIndexingSubgraphs({
    logger,
    graphNode,
  }: IndexingSubgraphMonitorOptions) {
    let client = axios.create({
      baseURL: graphNode,
    })

    while (true) {
      try {
        // Query graph-node for indexed subgraph versions
        let response = await client.post('/graphql', {
          query: `
          {
            indexingStatuses {
              subgraph
              node
            }
          }
        `,
        })

        // We only need the subgraph (ID) values
        let subgraphs: string[] = response.data.data.indexingStatuses
          .filter((status: any) => status.node !== 'removed')
          .map((status: any) => status.subgraph)

        // Identify subgraphs changes
        let removed = this.subgraphs.filter(subgraph => subgraphs.indexOf(subgraph) < 0)
        let added = subgraphs.filter(subgraph => this.subgraphs.indexOf(subgraph) < 0)
        let unchanged = this.subgraphs.filter(subgraph => subgraphs.indexOf(subgraph) > 0)

        // Update indexed subgraphs
        this.subgraphs = subgraphs

        // Emit the update
        if (removed.length > 0 || added.length > 0) {
          this.emit('updated', { removed, added, unchanged })
        }
      } catch (e) {
        logger.warn(`Failed to query indexed subgraphs: ${e}`)
      }

      // Wait 5s
      await delay(5000)
    }
  }
}
