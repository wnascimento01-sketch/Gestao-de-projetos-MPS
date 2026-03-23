export interface Company {
  id: string;
  name: string;
  description?: string;
}

export interface BDIConfig {
  centralAdmin: number;
  risk: number;
  guarantees: number;
  financialExpenses: number;
  taxes: number;
  socialCharges: number; // New field for labor social charges
  profit: number;
}

export interface Project {
  id: string;
  name: string;
  companyId: string;
  client: string;
  status: 'Active' | 'Completed' | 'On Hold' | 'Cancelled';
  startDate: string;
  endDate: string;
  bdi: BDIConfig;
}

export interface WBS {
  id: string;
  name: string;
  projectId: string;
  parentId?: string;
  description?: string;
}

export interface Resource {
  id: string;
  name: string;
  category: CostCategory;
  unit: string;
  unitCost: number;
  companyId: string;
}

export interface BudgetLine {
  id: string;
  description: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  categoryId: string;
  wbsId: string;
  projectId: string;
  companyId: string;
  overtimeHours?: number;
  overtimePercent?: number;
  resourceId?: string;
  bdiOverride?: number; // Individual BDI percentage override
}

export interface ActualCost {
  id: string;
  description: string;
  amount: number;
  date: string;
  vendor: string;
  categoryId: string;
  wbsId: string;
  projectId: string;
  companyId: string;
  documentRef?: string;
  lastModifiedBy: string;
}

export interface Measurement {
  id: string;
  projectId: string;
  companyId: string;
  number: number;
  amount: number;
  billingDate: string;
  expectedPaymentDate: string;
  actualPaymentDate?: string;
  status: 'Planned' | 'Billed' | 'Received';
}

export interface ScheduleTask {
  id: string;
  name: string;
  projectId: string;
  wbsId: string;
  startDate: string;
  endDate: string;
  duration: number;
  dependencies: string[];
  physicalProgress: number;
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
}

export interface PlannedDisbursement {
  id: string;
  projectId: string;
  companyId: string;
  budgetLineId?: string;
  category: CostCategory;
  description: string;
  amount: number;
  plannedDate: string;
  status: 'Planned' | 'Paid';
}

export interface UserProfile {
  id: string;
  email: string;
  role: 'Admin' | 'Engineering' | 'Finance' | 'Executive';
  companyAccess: string[];
}

export type CostCategory = 
  | 'Mão de obra direta'
  | 'Mão de obra indireta'
  | 'Engenharia'
  | 'Gestão projeto'
  | 'Materiais'
  | 'Estruturas metálicas'
  | 'Componentes mecânicos'
  | 'Componentes elétricos'
  | 'Automação'
  | 'EPI'
  | 'Ferramentas'
  | 'Equipamentos'
  | 'Serviços terceiros'
  | 'Usinagem'
  | 'Pintura'
  | 'Ensaios'
  | 'Fretes'
  | 'Logística'
  | 'Mobilização'
  | 'Desmobilização'
  | 'Viagens'
  | 'Hospedagem'
  | 'Alimentação'
  | 'Outros'
  | 'Contingência';
