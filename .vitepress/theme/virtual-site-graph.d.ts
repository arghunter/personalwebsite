declare module 'virtual:site-graph' {
  export interface GraphNode {
    id: string
    label: string
    type: 'internal' | 'external'
    url: string
    domain?: string
  }
  export interface GraphEdge {
    from: string
    to: string
  }
  const data: { nodes: GraphNode[]; edges: GraphEdge[] }
  export default data
}
