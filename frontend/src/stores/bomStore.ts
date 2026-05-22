import { create } from 'zustand'
import type { BomNode } from '../types'

interface BomStore {
  selectedVehicleId: number | null
  selectedCategory: string | null
  selectedNodeId: number | null
  expandedKeys: React.Key[]
  treeData: BomNode[]
  setVehicle: (id: number | null) => void
  setCategory: (code: string | null) => void
  selectNode: (id: number | null) => void
  setExpandedKeys: (keys: React.Key[]) => void
  setTreeData: (nodes: BomNode[]) => void
}

export const useBomStore = create<BomStore>((set) => ({
  selectedVehicleId: null,
  selectedCategory: null,
  selectedNodeId: null,
  expandedKeys: [],
  treeData: [],
  setVehicle: (id) => set({ selectedVehicleId: id, selectedNodeId: null, expandedKeys: [], treeData: [] }),
  setCategory: (code) => set({ selectedCategory: code, selectedNodeId: null }),
  selectNode: (id) => set({ selectedNodeId: id }),
  setExpandedKeys: (keys) => set({ expandedKeys: keys }),
  setTreeData: (nodes) => set({ treeData: nodes }),
}))
