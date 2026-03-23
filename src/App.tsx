import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart3, 
  LayoutDashboard, 
  Briefcase, 
  Calculator, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Users, 
  LogOut, 
  Plus, 
  ChevronRight, 
  Building2, 
  Settings,
  FileText,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Menu,
  X,
  Search,
  Filter,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  Database,
  Check,
  Edit
} from 'lucide-react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  doc, 
  getDoc, 
  setDoc, 
  query, 
  where, 
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell,
  AreaChart,
  Area
} from 'recharts';
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { 
  Company, 
  Project, 
  WBS, 
  BudgetLine, 
  ActualCost, 
  Measurement, 
  ScheduleTask, 
  PlannedDisbursement,
  UserProfile,
  CostCategory,
  Resource,
  BDIConfig
} from './types';
import { formatCurrency, formatPercent, calculateSellingPrice, calculateEVM } from './utils';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: any, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full gap-3 px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg group",
      active 
        ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/20" 
        : "text-slate-400 hover:bg-slate-800 hover:text-white"
    )}
  >
    <Icon className={cn("w-5 h-5", active ? "text-white" : "text-slate-400 group-hover:text-white")} />
    <span>{label}</span>
  </button>
);

interface BudgetRowProps {
  resource: Resource;
  initialLine?: BudgetLine;
  onSave: (r: Resource, q: number, oh?: number, op?: number, bdi?: number) => Promise<void> | void;
  isLabor: boolean;
  bdiConfig: BDIConfig;
}

const BudgetRow: React.FC<BudgetRowProps> = ({ resource, initialLine, onSave, isLabor, bdiConfig }) => {
  const [quantity, setQuantity] = useState(initialLine?.quantity || 0);
  const [overtimeHours, setOvertimeHours] = useState(initialLine?.overtimeHours || 0);
  const [overtimePercent, setOvertimePercent] = useState(initialLine?.overtimePercent || 0);
  const [bdiOverride, setBdiOverride] = useState(initialLine?.bdiOverride || 0);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (initialLine) {
      setQuantity(initialLine.quantity);
      setOvertimeHours(initialLine.overtimeHours || 0);
      setOvertimePercent(initialLine.overtimePercent || 0);
      setBdiOverride(initialLine.bdiOverride || 0);
    } else {
      setQuantity(0);
      setOvertimeHours(0);
      setOvertimePercent(0);
      setBdiOverride(0);
    }
  }, [initialLine, resource.id]);

  const directCost = (quantity * resource.unitCost) + (overtimeHours * resource.unitCost * (1 + overtimePercent / 100));
  const costWithSocialCharges = isLabor ? directCost * (1 + bdiConfig.socialCharges / 100) : directCost;
  const sellingPrice = calculateSellingPrice(directCost, bdiConfig, resource.category, bdiOverride || undefined);

  const handleSave = () => {
    onSave(resource, quantity, overtimeHours, overtimePercent, bdiOverride || undefined);
    setIsEditing(false);
  };

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="py-4 text-sm font-medium text-slate-900">{resource.name}</td>
      <td className="py-4 text-sm text-slate-500">{resource.unit}</td>
      <td className="py-4 text-sm text-slate-500">{formatCurrency(resource.unitCost)}</td>
      <td className="py-4">
        <input
          type="number"
          value={quantity}
          onChange={(e) => { setQuantity(Number(e.target.value)); setIsEditing(true); }}
          className="w-20 px-2 py-1 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none"
        />
      </td>
      {isLabor && (
        <>
          <td className="py-4">
            <input
              type="number"
              value={overtimeHours}
              onChange={(e) => { setOvertimeHours(Number(e.target.value)); setIsEditing(true); }}
              className="w-20 px-2 py-1 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none"
            />
          </td>
          <td className="py-4">
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={overtimePercent}
                onChange={(e) => { setOvertimePercent(Number(e.target.value)); setIsEditing(true); }}
                className="w-16 px-2 py-1 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none"
              />
              <span className="text-xs text-slate-400">%</span>
            </div>
          </td>
        </>
      )}
      <td className="py-4">
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={bdiOverride}
            onChange={(e) => { setBdiOverride(Number(e.target.value)); setIsEditing(true); }}
            className="w-16 px-2 py-1 border border-slate-200 rounded text-sm focus:ring-2 focus:ring-brand-blue focus:border-brand-blue outline-none"
            placeholder="BDI %"
          />
          <span className="text-xs text-slate-400">%</span>
        </div>
      </td>
      <td className="py-4 text-sm font-bold text-slate-900 text-right">{formatCurrency(costWithSocialCharges)}</td>
      <td className="py-4 text-sm font-bold text-brand-blue text-right">{formatCurrency(sellingPrice)}</td>
      <td className="py-4 text-right">
        {isEditing ? (
          <button
            onClick={handleSave}
            className="p-1.5 bg-brand-blue/10 text-brand-blue rounded-lg hover:bg-brand-blue/20 transition-colors"
            title="Salvar"
          >
            <Check className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-xs text-slate-400 italic">Salvo</span>
        )}
      </td>
    </tr>
  );
};

// --- Cash Flow Module ---

const CashFlowModule = ({ 
  projects, 
  allBudgetLines, 
  allMeasurements, 
  allPlannedDisbursements, 
  allResources,
  selectedProjectId 
}: { 
  projects: Project[], 
  allBudgetLines: BudgetLine[], 
  allMeasurements: Measurement[], 
  allPlannedDisbursements: PlannedDisbursement[],
  allResources: Resource[],
  selectedProjectId?: string 
}) => {
  const [isAddingDisbursement, setIsAddingDisbursement] = useState(false);
  const [newDisbursement, setNewDisbursement] = useState<Partial<PlannedDisbursement>>({
    description: '',
    amount: 0,
    plannedDate: format(new Date(), 'yyyy-MM-dd'),
    category: 'Materiais',
    status: 'Planned'
  });

  const filteredProjects = selectedProjectId 
    ? projects.filter(p => p.id === selectedProjectId)
    : projects;

  const projectIds = filteredProjects.map(p => p.id);
  
  const disbursements = allPlannedDisbursements.filter(d => projectIds.includes(d.projectId));
  const revenues = allMeasurements.filter(m => projectIds.includes(m.projectId));

  const handleAddDisbursement = async () => {
    if (!newDisbursement.description || !newDisbursement.amount || !newDisbursement.projectId) return;
    
    try {
      await addDoc(collection(db, 'plannedDisbursements'), {
        ...newDisbursement,
        companyId: projects.find(p => p.id === newDisbursement.projectId)?.companyId || ''
      });
      setIsAddingDisbursement(false);
      setNewDisbursement({
        description: '',
        amount: 0,
        plannedDate: format(new Date(), 'yyyy-MM-dd'),
        category: 'Materiais',
        status: 'Planned'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'plannedDisbursements');
    }
  };

  const handleDeleteDisbursement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'plannedDisbursements', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'plannedDisbursements');
    }
  };

  // Prepare data for chart
  const months = useMemo(() => {
    const allDates = [
      ...disbursements.map(d => d.plannedDate),
      ...revenues.map(r => r.expectedPaymentDate)
    ].filter(Boolean);

    if (allDates.length === 0) return [];

    const sortedDates = allDates.sort();
    const start = startOfMonth(parseISO(sortedDates[0]));
    const end = endOfMonth(parseISO(sortedDates[sortedDates.length - 1]));
    
    return eachMonthOfInterval({ start, end });
  }, [disbursements, revenues]);

  const chartData = useMemo(() => {
    return months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const monthDisbursements = disbursements.filter(d => d.plannedDate.startsWith(monthStr));
      const monthRevenues = revenues.filter(r => r.expectedPaymentDate.startsWith(monthStr));

      const outflow = monthDisbursements.reduce((acc, d) => acc + d.amount, 0);
      const inflow = monthRevenues.reduce((acc, r) => acc + r.amount, 0);

      return {
        name: format(month, 'MMM/yy', { locale: ptBR }),
        entrada: inflow,
        saida: outflow,
        saldo: inflow - outflow
      };
    });
  }, [months, disbursements, revenues]);

  const totalInflow = revenues.reduce((acc, r) => acc + r.amount, 0);
  const totalOutflow = disbursements.reduce((acc, d) => acc + d.amount, 0);

  const handleDistributeBudget = async () => {
    if (!selectedProjectId) return;
    const project = projects.find(p => p.id === selectedProjectId);
    if (!project) return;

    const budgetLines = allBudgetLines.filter(b => b.projectId === selectedProjectId);
    
    try {
      for (const line of budgetLines) {
        // Simple distribution: create one disbursement for the project start date
        // In a more advanced version, we could spread it over months
        await addDoc(collection(db, 'plannedDisbursements'), {
          projectId: selectedProjectId,
          companyId: project.companyId,
          budgetLineId: line.id,
          category: line.categoryId,
          description: `[Orçado] ${line.description}`,
          amount: line.totalCost,
          plannedDate: project.startDate,
          status: 'Planned'
        });
      }
      alert('Orçamento distribuído com sucesso! Você pode ajustar as datas individualmente na lista abaixo.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'plannedDisbursements');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Total Entradas Previstas" value={formatCurrency(totalInflow)} icon={ArrowUpRight} color="bg-emerald-500" />
        <StatCard label="Total Saídas Previstas" value={formatCurrency(totalOutflow)} icon={ArrowDownRight} color="bg-rose-500" />
        <StatCard label="Saldo Projetado" value={formatCurrency(totalInflow - totalOutflow)} icon={DollarSign} color="bg-brand-blue" />
      </div>

      <Card title="Fluxo de Caixa Projetado" subtitle="Entradas vs Saídas por mês">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(value) => `R$ ${value / 1000}k`} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
              />
              <Legend />
              <Bar dataKey="entrada" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saida" name="Saídas" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Cronograma de Desembolsos (Saídas)" subtitle="Planejamento de pagamentos">
          <div className="space-y-4">
            <div className="flex justify-end gap-2">
              <button 
                onClick={handleDistributeBudget}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-all font-medium text-sm"
                title="Cria desembolsos baseados no orçamento do projeto"
              >
                <Calculator className="w-4 h-4" /> Distribuir Orçamento
              </button>
              <button 
                onClick={() => setIsAddingDisbursement(true)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-xl hover:bg-brand-blue/90 transition-all font-medium text-sm"
              >
                <Plus className="w-4 h-4" /> Novo Desembolso
              </button>
            </div>

            {isAddingDisbursement && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Projeto</label>
                    <select 
                      value={newDisbursement.projectId}
                      onChange={(e) => setNewDisbursement({ ...newDisbursement, projectId: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-blue"
                    >
                      <option value="">Selecione um projeto</option>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                    <input 
                      type="text"
                      value={newDisbursement.description}
                      onChange={(e) => setNewDisbursement({ ...newDisbursement, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-blue"
                      placeholder="Ex: Pagamento Fornecedor A"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor</label>
                    <input 
                      type="number"
                      value={newDisbursement.amount}
                      onChange={(e) => setNewDisbursement({ ...newDisbursement, amount: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Prevista</label>
                    <input 
                      type="date"
                      value={newDisbursement.plannedDate}
                      onChange={(e) => setNewDisbursement({ ...newDisbursement, plannedDate: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-blue"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setIsAddingDisbursement(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg text-sm font-medium">Cancelar</button>
                  <button onClick={handleAddDisbursement} className="px-4 py-2 bg-brand-blue text-white rounded-lg text-sm font-medium">Salvar</button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="pb-4 font-semibold text-slate-500 text-sm">Data</th>
                    <th className="pb-4 font-semibold text-slate-500 text-sm">Descrição</th>
                    <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Valor</th>
                    <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {disbursements.length === 0 ? (
                    <tr><td colSpan={4} className="py-8 text-center text-slate-400 italic">Nenhum desembolso planejado</td></tr>
                  ) : disbursements.sort((a, b) => a.plannedDate.localeCompare(b.plannedDate)).map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 text-sm text-slate-600">{format(parseISO(d.plannedDate), 'dd/MM/yyyy')}</td>
                      <td className="py-4 text-sm font-medium text-slate-900">{d.description}</td>
                      <td className="py-4 text-sm font-bold text-rose-600 text-right">{formatCurrency(d.amount)}</td>
                      <td className="py-4 text-right">
                        <button onClick={() => handleDeleteDisbursement(d.id)} className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors">
                          <LogOut className="w-4 h-4 rotate-180" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        <Card title="Cronograma de Receitas (Entradas)" subtitle="Planejamento de recebimentos">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-4 font-semibold text-slate-500 text-sm">Data Prevista</th>
                  <th className="pb-4 font-semibold text-slate-500 text-sm">Medição</th>
                  <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Valor</th>
                  <th className="pb-4 font-semibold text-slate-500 text-sm">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {revenues.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-slate-400 italic">Nenhuma receita planejada</td></tr>
                ) : revenues.sort((a, b) => a.expectedPaymentDate.localeCompare(b.expectedPaymentDate)).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 text-sm text-slate-600">{format(parseISO(r.expectedPaymentDate), 'dd/MM/yyyy')}</td>
                    <td className="py-4 text-sm font-medium text-slate-900">Medição #{r.number}</td>
                    <td className="py-4 text-sm font-bold text-emerald-600 text-right">{formatCurrency(r.amount)}</td>
                    <td className="py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-[10px] font-bold uppercase",
                        r.status === 'Received' ? "bg-emerald-100 text-emerald-700" :
                        r.status === 'Billed' ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-700"
                      )}>
                        {r.status === 'Received' ? 'Recebido' : r.status === 'Billed' ? 'Faturado' : 'Planejado'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

const ResourceManagement = ({ resources, categories, companyId }: { resources: Resource[], categories: CostCategory[], companyId: string }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [formData, setFormData] = useState<Partial<Resource>>({
    name: '',
    category: 'Mão de obra direta',
    unit: 'UN',
    unitCost: 0,
    companyId: companyId
  });

  const handleSave = async () => {
    if (!formData.name || !formData.category || !formData.unit) return;
    
    try {
      if (editingResource) {
        await updateDoc(doc(db, 'resources', editingResource.id), formData);
      } else {
        await addDoc(collection(db, 'resources'), formData);
      }
      setIsAdding(false);
      setEditingResource(null);
      setFormData({ name: '', category: 'Mão de obra direta', unit: 'UN', unitCost: 0, companyId });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'resources');
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Catálogo de Recursos" subtitle="Gerencie os recursos e seus custos unitários" action={
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold text-sm hover:bg-brand-blue-light transition-all"
        >
          <Plus className="w-4 h-4" />
          Novo Recurso
        </button>
      }>
        {(isAdding || editingResource) && (
          <div className="mb-8 p-6 bg-slate-50 rounded-xl border border-slate-200">
            <h4 className="font-bold text-slate-900 mb-4">{editingResource ? 'Editar Recurso' : 'Novo Recurso'}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value as CostCategory })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue"
                >
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidade</label>
                <input
                  type="text"
                  value={formData.unit}
                  onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Custo Unitário</label>
                <input
                  type="number"
                  value={formData.unitCost}
                  onChange={e => setFormData({ ...formData, unitCost: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => { setIsAdding(false); setEditingResource(null); }}
                className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-100 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-brand-blue text-white font-bold rounded-lg hover:bg-brand-blue-light transition-all shadow-md"
              >
                Salvar Recurso
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-4 font-semibold text-slate-500 text-sm">Nome</th>
                <th className="pb-4 font-semibold text-slate-500 text-sm">Categoria</th>
                <th className="pb-4 font-semibold text-slate-500 text-sm">Un.</th>
                <th className="pb-4 font-semibold text-slate-500 text-sm">Custo Unit.</th>
                <th className="pb-4 font-semibold text-slate-500 text-sm">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resources.map(res => (
                <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-4 text-sm font-medium text-slate-900">{res.name}</td>
                  <td className="py-4 text-xs font-bold text-slate-500">{res.category}</td>
                  <td className="py-4 text-sm text-slate-500">{res.unit}</td>
                  <td className="py-4 text-sm text-slate-900 font-medium">{formatCurrency(res.unitCost)}</td>
                  <td className="py-4">
                    <button 
                      onClick={() => { setEditingResource(res); setFormData(res); }}
                      className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/5 rounded-lg transition-all"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const Card = ({ children, className, title, subtitle, action, onClick }: { children: React.ReactNode, className?: string, title?: string, subtitle?: string, action?: React.ReactNode, onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn("bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden", onClick && "cursor-pointer", className)}
  >
    {(title || subtitle || action) && (
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <div>
          {title && <h3 className="text-lg font-semibold text-slate-900">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className="p-6">{children}</div>
  </div>
);

const StatCard = ({ label, value, trend, trendValue, icon: Icon, color }: { label: string, value: string, trend?: 'up' | 'down', trendValue?: string, icon: any, color: string }) => (
  <Card className="p-0">
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            trend === 'up' ? "bg-brand-blue/5 text-brand-blue" : "bg-rose-50 text-rose-600"
          )}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <h4 className="text-2xl font-bold text-slate-900 mt-1">{value}</h4>
    </div>
  </Card>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [showNewCostModal, setShowNewCostModal] = useState(false);
  const [showNewMeasurementModal, setShowNewMeasurementModal] = useState(false);
  
  const [newProject, setNewProject] = useState({
    name: '',
    companyId: '',
    client: '',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    status: 'Active' as const,
    bdi: {
      centralAdmin: 5,
      risk: 2,
      guarantees: 1,
      financialExpenses: 2,
      taxes: 15,
      socialCharges: 80,
      profit: 10
    }
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.companyId) return;
    
    try {
      await addDoc(collection(db, 'projects'), newProject);
      setShowNewProjectModal(false);
      setNewProject({
        name: '',
        companyId: '',
        client: '',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'Active',
        bdi: {
          centralAdmin: 5,
          risk: 2,
          guarantees: 1,
          financialExpenses: 2,
          taxes: 15,
          socialCharges: 80,
          profit: 10
        }
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projects');
    }
  };

  const [newCost, setNewCost] = useState<Partial<ActualCost>>({
    description: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    supplier: '',
    categoryId: 'Materiais'
  });

  const handleCreateCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newCost.description || !newCost.amount) return;
    
    try {
      await addDoc(collection(db, 'actualCosts'), {
        ...newCost,
        projectId: selectedProjectId,
        companyId: projects.find(p => p.id === selectedProjectId)?.companyId || ''
      });
      setShowNewCostModal(false);
      setNewCost({
        description: '',
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        supplier: '',
        categoryId: 'Materiais'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'actualCosts');
    }
  };

  const [newMeasurement, setNewMeasurement] = useState<Partial<Measurement>>({
    description: '',
    amount: 0,
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'Pending'
  });

  const handleCreateMeasurement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId || !newMeasurement.description || !newMeasurement.amount) return;
    
    try {
      await addDoc(collection(db, 'measurements'), {
        ...newMeasurement,
        projectId: selectedProjectId,
        companyId: projects.find(p => p.id === selectedProjectId)?.companyId || ''
      });
      setShowNewMeasurementModal(false);
      setNewMeasurement({
        description: '',
        amount: 0,
        date: format(new Date(), 'yyyy-MM-dd'),
        status: 'Pending'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'measurements');
    }
  };

  // Data State
  const [companies, setCompanies] = useState<Company[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allActualCosts, setAllActualCosts] = useState<ActualCost[]>([]);
  const [allBudgetLines, setAllBudgetLines] = useState<BudgetLine[]>([]);
  const [allMeasurements, setAllMeasurements] = useState<Measurement[]>([]);
  const [allPlannedDisbursements, setAllPlannedDisbursements] = useState<PlannedDisbursement[]>([]);
  const [allScheduleTasks, setAllScheduleTasks] = useState<ScheduleTask[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [activeBudgetCategory, setActiveBudgetCategory] = useState<CostCategory>('Mão de obra direta');

  const budgetCategories: CostCategory[] = [
    'Mão de obra direta',
    'Mão de obra indireta',
    'EPI',
    'Materiais',
    'Equipamentos',
    'Serviços terceiros',
    'Logística',
    'Mobilização',
    'Desmobilização',
    'Viagens',
    'Outros',
    'Contingência'
  ];

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, 'users', u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          // Auto-create profile for the default admin
          if (u.email === "wnascimento01@yahoo.com.br") {
            const newProfile: UserProfile = {
              id: u.uid,
              email: u.email,
              role: 'Admin',
              companyAccess: []
            };
            await setDoc(docRef, newProfile);
            setProfile(newProfile);
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Data Listeners
  useEffect(() => {
    if (!user) return;

    const seedCompanies = async () => {
      const snap = await getDocs(collection(db, 'companies'));
      if (snap.empty) {
        await addDoc(collection(db, 'companies'), { name: 'MPS - Equipamentos e Serviços Ltda', description: 'Fabricação e Reforma' });
        await addDoc(collection(db, 'companies'), { name: 'MS Service', description: 'Manutenção e Montagem' });
      }
    };
    seedCompanies();

    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snap) => {
      setCompanies(snap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'companies'));

    const unsubProjects = onSnapshot(collection(db, 'projects'), (snap) => {
      setProjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Project)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'projects'));

    const unsubCosts = onSnapshot(collection(db, 'actualCosts'), (snap) => {
      setAllActualCosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActualCost)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'actualCosts'));

    const unsubBudget = onSnapshot(collection(db, 'budgetLines'), (snap) => {
      setAllBudgetLines(snap.docs.map(d => ({ id: d.id, ...d.data() } as BudgetLine)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'budgetLines'));

    const unsubMeasurements = onSnapshot(collection(db, 'measurements'), (snap) => {
      setAllMeasurements(snap.docs.map(d => ({ id: d.id, ...d.data() } as Measurement)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'measurements'));

    const unsubTasks = onSnapshot(collection(db, 'scheduleTasks'), (snap) => {
      setAllScheduleTasks(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduleTask)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'scheduleTasks'));

    const unsubPlannedDisbursements = onSnapshot(collection(db, 'plannedDisbursements'), (snap) => {
      setAllPlannedDisbursements(snap.docs.map(d => ({ id: d.id, ...d.data() } as PlannedDisbursement)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'plannedDisbursements'));

    const seedResources = async () => {
      const snap = await getDocs(collection(db, 'resources'));
      if (snap.empty) {
        const defaultResources = [
          { name: 'Mecânico', category: 'Mão de obra direta', unit: 'H', unitCost: 45, companyId: 'all' },
          { name: 'Soldador', category: 'Mão de obra direta', unit: 'H', unitCost: 50, companyId: 'all' },
          { name: 'Ajudante', category: 'Mão de obra direta', unit: 'H', unitCost: 25, companyId: 'all' },
          { name: 'Eletricista', category: 'Mão de obra direta', unit: 'H', unitCost: 48, companyId: 'all' },
          { name: 'Capacete', category: 'EPI', unit: 'UN', unitCost: 35, companyId: 'all' },
          { name: 'Botina', category: 'EPI', unit: 'PAR', unitCost: 85, companyId: 'all' },
          { name: 'Óculos', category: 'EPI', unit: 'UN', unitCost: 15, companyId: 'all' },
          { name: 'Uniforme', category: 'EPI', unit: 'CJ', unitCost: 120, companyId: 'all' },
          { name: 'Luva', category: 'EPI', unit: 'PAR', unitCost: 12, companyId: 'all' },
        ];
        for (const res of defaultResources) {
          await addDoc(collection(db, 'resources'), res);
        }
      }
    };
    seedResources();

    const unsubResources = onSnapshot(collection(db, 'resources'), (snap) => {
      setAllResources(snap.docs.map(d => ({ id: d.id, ...d.data() } as Resource)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'resources'));

    return () => {
      unsubCompanies();
      unsubProjects();
      unsubCosts();
      unsubBudget();
      unsubMeasurements();
      unsubTasks();
      unsubPlannedDisbursements();
      unsubResources();
    };
  }, [user]);

  // Derived Data for Dashboard
  const dashboardStats = useMemo(() => {
    const filteredProjects = selectedCompanyId === 'all' 
      ? projects 
      : projects.filter(p => p.companyId === selectedCompanyId);
    
    const projectIds = filteredProjects.map(p => p.id);
    
    const costs = allActualCosts.filter(c => projectIds.includes(c.projectId));
    const budget = allBudgetLines.filter(b => projectIds.includes(b.projectId));
    const measurements = allMeasurements.filter(m => projectIds.includes(m.projectId));
    
    const totalActualCost = costs.reduce((acc: number, c: ActualCost) => acc + c.amount, 0);
    const totalBudgetedCost = budget.reduce((acc: number, b: BudgetLine) => acc + b.totalCost, 0);
    const totalRevenue = measurements.filter(m => m.status === 'Received').reduce((acc: number, m: Measurement) => acc + m.amount, 0);
    const totalBilled = measurements.filter(m => m.status === 'Billed').reduce((acc: number, m: Measurement) => acc + m.amount, 0);
    
    const profit = totalRevenue - totalActualCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      totalActualCost,
      totalBudgetedCost,
      totalRevenue,
      totalBilled,
      profit,
      margin,
      activeProjects: filteredProjects.filter(p => p.status === 'Active').length,
      totalProjects: filteredProjects.length
    };
  }, [projects, allActualCosts, allBudgetLines, allMeasurements, selectedCompanyId]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleSaveBudgetLine = async (resource: Resource, quantity: number, overtimeHours: number = 0, overtimePercent: number = 0, bdiOverride?: number) => {
    if (!selectedProjectId) return;
    
    const existingLine = allBudgetLines.find(b => b.projectId === selectedProjectId && b.resourceId === resource.id);
    
    const totalCost = (quantity * resource.unitCost) + (overtimeHours * resource.unitCost * (1 + overtimePercent / 100));
    
    const budgetLineData = {
      description: resource.name,
      unit: resource.unit,
      quantity,
      unitCost: resource.unitCost,
      totalCost,
      categoryId: resource.category,
      projectId: selectedProjectId,
      companyId: projects.find(p => p.id === selectedProjectId)?.companyId || '',
      resourceId: resource.id,
      overtimeHours,
      overtimePercent,
      bdiOverride,
      wbsId: 'default'
    };

    try {
      if (existingLine) {
        await updateDoc(doc(db, 'budgetLines', existingLine.id), budgetLineData);
      } else {
        await addDoc(collection(db, 'budgetLines'), budgetLineData);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'budgetLines');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Iniciando ERP Industrial...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 overflow-hidden relative">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(62,96,128,0.1),transparent_70%)]"></div>
          <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative z-10 w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl"
        >
          <div className="flex flex-col items-center text-center">
            <div className="p-4 bg-white rounded-2xl shadow-lg mb-6">
              <img src="https://storage.googleapis.com/static.antigravity.ai/projects/0cb2512f-4ddd-48fb-a3e3-9bcb8f848bdf/logo.png" className="w-32 h-auto" alt="MPS Logo" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">MPS</h1>
            <p className="text-slate-400 mb-8">ERP de Gestão de Contratos e Obras Industriais</p>
            
            <button
              onClick={handleLogin}
              className="flex items-center justify-center w-full gap-3 px-6 py-4 text-lg font-semibold text-white transition-all duration-300 bg-brand-blue rounded-xl hover:bg-brand-blue-light hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-blue/20"
            >
              <img src="https://www.google.com/favicon.ico" className="w-6 h-6 bg-white rounded-full p-1" alt="Google" />
              Acessar com Google
            </button>
            
            <p className="mt-8 text-xs text-slate-500 uppercase tracking-widest font-bold">Sistema de Gestão Industrial v1.0</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (selectedProjectId) {
    const project = projects.find(p => p.id === selectedProjectId);
    const company = companies.find(c => c.id === project?.companyId);

    return (
      <div className="flex min-h-screen bg-slate-50 text-slate-900">
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 sticky top-0 h-screen">
          <div className="p-6">
            <button 
              onClick={() => setSelectedProjectId(null)}
              className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
            >
              <X className="w-4 h-4" />
              Voltar aos Projetos
            </button>

            <div className="mb-8">
              <h2 className="text-lg font-bold text-white leading-tight truncate">{project?.name}</h2>
              <p className="text-[10px] text-brand-orange font-bold uppercase tracking-wider">{company?.name}</p>
            </div>

            <nav className="space-y-2">
              <SidebarItem icon={LayoutDashboard} label="Visão Geral" active={activeTab === 'project-overview'} onClick={() => setActiveTab('project-overview')} />
              <SidebarItem icon={Calculator} label="Orçamento / BDI" active={activeTab === 'project-budget'} onClick={() => setActiveTab('project-budget')} />
              <SidebarItem icon={Calendar} label="Cronograma / WBS" active={activeTab === 'project-schedule'} onClick={() => setActiveTab('project-schedule')} />
              <SidebarItem icon={DollarSign} label="Custos Reais" active={activeTab === 'project-costs'} onClick={() => setActiveTab('project-costs')} />
              <SidebarItem icon={TrendingUp} label="Performance EVM" active={activeTab === 'project-evm'} onClick={() => setActiveTab('project-evm')} />
              <SidebarItem icon={FileText} label="Medições" active={activeTab === 'project-measurements'} onClick={() => setActiveTab('project-measurements')} />
              <SidebarItem icon={TrendingUp} label="Fluxo de Caixa" active={activeTab === 'project-cashflow'} onClick={() => setActiveTab('project-cashflow')} />
            </nav>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-auto">
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold text-slate-900 capitalize">{activeTab.replace('project-', '')}</h2>
              <span className="px-2 py-1 bg-brand-blue/10 text-brand-blue text-[10px] font-bold rounded uppercase">{project?.status}</span>
            </div>
          </header>

          <div className="p-8">
            {activeTab === 'project-overview' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard label="Custo Orçado" value={formatCurrency(allBudgetLines.filter(b => b.projectId === selectedProjectId).reduce((acc: number, b: BudgetLine) => acc + b.totalCost, 0))} icon={Calculator} color="bg-slate-800" />
                  <StatCard label="Custo Real" value={formatCurrency(allActualCosts.filter(c => c.projectId === selectedProjectId).reduce((acc: number, c: ActualCost) => acc + c.amount, 0))} icon={DollarSign} color="bg-rose-600" />
                  <StatCard label="Faturamento" value={formatCurrency(allMeasurements.filter(m => m.projectId === selectedProjectId && m.status === 'Received').reduce((acc: number, m: Measurement) => acc + m.amount, 0))} icon={TrendingUp} color="bg-brand-blue" />
                </div>

                <Card title="Composição de BDI e Encargos" subtitle="Configuração de margens, impostos e encargos sociais">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {Object.entries(project?.bdi || {}).map(([key, value]) => (
                      <div key={key} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">
                          {key === 'centralAdmin' ? 'Adm. Central' :
                           key === 'risk' ? 'Risco' :
                           key === 'guarantees' ? 'Garantias' :
                           key === 'financialExpenses' ? 'Desp. Finan.' :
                           key === 'taxes' ? 'Impostos' :
                           key === 'socialCharges' ? 'Encargos Sociais' :
                           key === 'profit' ? 'Lucro' : key}
                        </p>
                        <p className="text-lg font-bold text-slate-900">{value}%</p>
                      </div>
                    ))}
                    <div className="p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/10">
                      <p className="text-[10px] text-brand-blue uppercase font-bold mb-1">BDI Total (Divisor)</p>
                      <p className="text-lg font-bold text-brand-blue">
                        {(
                          (project?.bdi?.centralAdmin || 0) +
                          (project?.bdi?.risk || 0) +
                          (project?.bdi?.guarantees || 0) +
                          (project?.bdi?.financialExpenses || 0) +
                          (project?.bdi?.taxes || 0) +
                          (project?.bdi?.profit || 0)
                        ).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'project-budget' && (
              <div className="space-y-6">
                <Card title="Configuração de BDI e Encargos" subtitle="Defina as margens globais do projeto">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {Object.entries(project?.bdi || {}).map(([key, value]) => (
                      <div key={key}>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          {key === 'centralAdmin' ? 'Adm. Central' :
                           key === 'risk' ? 'Risco' :
                           key === 'guarantees' ? 'Garantias' :
                           key === 'financialExpenses' ? 'Desp. Finan.' :
                           key === 'taxes' ? 'Impostos' :
                           key === 'socialCharges' ? 'Encargos Sociais' :
                           key === 'profit' ? 'Lucro' : key} (%)
                        </label>
                        <input
                          type="number"
                          value={value}
                          onChange={async (e) => {
                            const newValue = Number(e.target.value);
                            const updatedBdi = { ...project?.bdi, [key]: newValue };
                            try {
                              await updateDoc(doc(db, 'projects', selectedProjectId!), { bdi: updatedBdi });
                            } catch (err) {
                              handleFirestoreError(err, OperationType.WRITE, 'projects');
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-brand-blue text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex flex-col justify-end">
                      <p className="text-[10px] text-brand-blue uppercase font-bold mb-1">BDI Total (Divisor)</p>
                      <p className="text-lg font-bold text-brand-blue py-2">
                        {(
                          (project?.bdi?.centralAdmin || 0) +
                          (project?.bdi?.risk || 0) +
                          (project?.bdi?.guarantees || 0) +
                          (project?.bdi?.financialExpenses || 0) +
                          (project?.bdi?.taxes || 0) +
                          (project?.bdi?.profit || 0)
                        ).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </Card>

                <Card title="Planejamento de Recursos" subtitle="Defina as quantidades por tipo de recurso">
                  <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-100 pb-4">
                    {budgetCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveBudgetCategory(cat)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                          activeBudgetCategory === cat
                            ? 'bg-brand-blue text-white shadow-md'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Recurso</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Un.</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Custo Unit.</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Qtd. Prevista</th>
                          {(activeBudgetCategory === 'Mão de obra direta' || activeBudgetCategory === 'Mão de obra indireta') && (
                            <>
                              <th className="pb-4 font-semibold text-slate-500 text-sm">H.E. Previstas</th>
                              <th className="pb-4 font-semibold text-slate-500 text-sm">% Adicional</th>
                            </>
                          )}
                          <th className="pb-4 font-semibold text-slate-500 text-sm">BDI %</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Custo Direto</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Preço Venda</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {allResources.filter(r => r.category === activeBudgetCategory).map(resource => {
                            const line = allBudgetLines.find(b => b.projectId === selectedProjectId && b.resourceId === resource.id);
                            const isLabor = activeBudgetCategory === 'Mão de obra direta' || activeBudgetCategory === 'Mão de obra indireta';
                            return (
                              <BudgetRow 
                                key={resource.id} 
                                resource={resource} 
                                initialLine={line} 
                                onSave={handleSaveBudgetLine}
                                isLabor={isLabor}
                                bdiConfig={project?.bdi || { centralAdmin: 0, risk: 0, guarantees: 0, financialExpenses: 0, taxes: 0, socialCharges: 0, profit: 0 }}
                              />
                            );
                          })}
                          {allResources.filter(r => r.category === activeBudgetCategory).length === 0 && (
                            <tr>
                              <td colSpan={(activeBudgetCategory === 'Mão de obra direta' || activeBudgetCategory === 'Mão de obra indireta') ? 9 : 7} className="py-8 text-center text-slate-400 italic">
                                Nenhum recurso cadastrado nesta categoria
                              </td>
                            </tr>
                          )}
                      </tbody>
                    </table>
                  </div>
                </Card>

                <Card title="Resumo do Orçamento" subtitle="Total acumulado por categoria">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {budgetCategories.map(cat => {
                      const total = allBudgetLines
                        .filter(b => b.projectId === selectedProjectId && b.categoryId === cat)
                        .reduce((acc, b) => acc + b.totalCost, 0);
                      if (total === 0) return null;
                      return (
                        <div key={cat} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                          <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">{cat}</p>
                          <p className="text-lg font-bold text-slate-900">{formatCurrency(total)}</p>
                        </div>
                      );
                    })}
                    <div className="p-4 bg-brand-blue/5 rounded-xl border border-brand-blue/10">
                      <p className="text-[10px] text-brand-blue uppercase font-bold mb-1">Total Geral</p>
                      <p className="text-lg font-bold text-brand-blue">
                        {formatCurrency(allBudgetLines.filter(b => b.projectId === selectedProjectId).reduce((acc, b) => acc + b.totalCost, 0))}
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'project-costs' && (
              <Card title="Lançamentos de Custos Reais" subtitle="Registro de despesas e notas fiscais" action={
                <button 
                  onClick={() => setShowNewCostModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg font-bold text-sm hover:bg-rose-700 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Novo Lançamento
                </button>
              }>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Data</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Descrição</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Fornecedor</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Categoria</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allActualCosts.filter(c => c.projectId === selectedProjectId).map(c => (
                        <tr key={c.id}>
                          <td className="py-4 text-sm">{c.date}</td>
                          <td className="py-4 text-sm font-medium">{c.description}</td>
                          <td className="py-4 text-sm text-slate-500">{c.supplier}</td>
                          <td className="py-4 text-xs font-bold text-slate-500">{c.categoryId}</td>
                          <td className="py-4 text-sm font-bold text-right">{formatCurrency(c.amount)}</td>
                        </tr>
                      ))}
                      {allActualCosts.filter(c => c.projectId === selectedProjectId).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic">Nenhum custo registrado</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === 'project-schedule' && (
              <Card title="Cronograma de Atividades" subtitle="WBS e prazos de execução">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Atividade</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Início</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Fim</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Progresso</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allScheduleTasks.filter(t => t.projectId === selectedProjectId).map(t => (
                        <tr key={t.id}>
                          <td className="py-4 text-sm font-medium">{t.name}</td>
                          <td className="py-4 text-sm">{t.startDate}</td>
                          <td className="py-4 text-sm">{t.endDate}</td>
                          <td className="py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 bg-slate-100 rounded-full h-1.5">
                                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${t.progress}%` }}></div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{t.progress}%</span>
                            </div>
                          </td>
                          <td className="py-4">
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded",
                              t.status === 'Completed' ? "bg-brand-blue/10 text-brand-blue" : 
                              t.status === 'In Progress' ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"
                            )}>
                              {t.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {allScheduleTasks.filter(t => t.projectId === selectedProjectId).length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400 italic">Nenhuma atividade cadastrada</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === 'project-measurements' && (
              <Card title="Medições e Faturamento" subtitle="Histórico de faturamento do projeto" action={
                <button 
                  onClick={() => setShowNewMeasurementModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold text-sm hover:bg-brand-blue-light transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nova Medição
                </button>
              }>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Data</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm">Descrição</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Valor</th>
                        <th className="pb-4 font-semibold text-slate-500 text-sm text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allMeasurements.filter(m => m.projectId === selectedProjectId).map(m => (
                        <tr key={m.id}>
                          <td className="py-4 text-sm">{m.date}</td>
                          <td className="py-4 text-sm font-medium">{m.description}</td>
                          <td className="py-4 text-sm font-bold text-right">{formatCurrency(m.amount)}</td>
                          <td className="py-4 text-center">
                            <span className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded",
                              m.status === 'Received' ? "bg-brand-blue/10 text-brand-blue" : 
                              m.status === 'Invoiced' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                            )}>
                              {m.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {allMeasurements.filter(m => m.projectId === selectedProjectId).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-400 italic">Nenhuma medição realizada</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {activeTab === 'project-evm' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card title="Indicadores de Performance" subtitle="Análise de Valor Agregado">
                    <div className="space-y-6 mt-4">
                      {(() => {
                        const projectBudget = allBudgetLines.filter(b => b.projectId === selectedProjectId);
                        const bac = projectBudget.reduce((acc: number, b: BudgetLine) => acc + b.totalCost, 0);
                        const ac = allActualCosts.filter(c => c.projectId === selectedProjectId).reduce((acc: number, c: ActualCost) => acc + c.amount, 0);
                        const progress = 0.45; // Mock
                        const ev = bac * progress;
                        const cpi = ac > 0 ? ev / ac : 1;
                        const spi = 0.92; // Mock

                        return (
                          <>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">CPI (Custo)</p>
                                <p className={cn("text-2xl font-bold", cpi >= 1 ? "text-brand-blue" : "text-rose-600")}>{cpi.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase">Status</p>
                                <p className="text-sm font-bold text-slate-700">{cpi >= 1 ? 'Dentro do Orçado' : 'Acima do Orçado'}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                              <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">SPI (Prazo)</p>
                                <p className={cn("text-2xl font-bold", spi >= 1 ? "text-brand-blue" : "text-amber-600")}>{spi.toFixed(2)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs font-bold text-slate-400 uppercase">Status</p>
                                <p className="text-sm font-bold text-slate-700">{spi >= 1 ? 'No Prazo' : 'Atrasado'}</p>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </Card>
                  <Card title="Resumo Financeiro EVM" subtitle="Valores em Reais">
                    <div className="space-y-4 mt-4">
                      {(() => {
                        const projectBudget = allBudgetLines.filter(b => b.projectId === selectedProjectId);
                        const bac = projectBudget.reduce((acc: number, b: BudgetLine) => acc + b.totalCost, 0);
                        const ac = allActualCosts.filter(c => c.projectId === selectedProjectId).reduce((acc: number, c: ActualCost) => acc + c.amount, 0);
                        const progress = 0.45; // Mock
                        const ev = bac * progress;
                        const cv = ev - ac;
                        const sv = ev - bac; // This is actually SV = EV - PV, but using BAC as PV for simplicity here

                        return (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Valor Planejado (BAC)</span>
                              <span className="font-bold">{formatCurrency(bac)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Valor Agregado (EV)</span>
                              <span className="font-bold">{formatCurrency(ev)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Custo Real (AC)</span>
                              <span className="font-bold">{formatCurrency(ac)}</span>
                            </div>
                            <div className="pt-4 border-t border-slate-100">
                              <div className="flex justify-between text-sm">
                                <span className="text-slate-500">Variação de Custo (CV)</span>
                                <span className={cn("font-bold", cv >= 0 ? "text-brand-blue" : "text-rose-600")}>{formatCurrency(cv)}</span>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'project-cashflow' && (
              <CashFlowModule 
                projects={projects} 
                allBudgetLines={allBudgetLines} 
                allMeasurements={allMeasurements} 
                allPlannedDisbursements={allPlannedDisbursements}
                allResources={allResources}
                selectedProjectId={selectedProjectId!} 
              />
            )}

            {/* Modals for Costs and Measurements */}
            {showNewCostModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-900">Novo Lançamento de Custo</h3>
                    <button onClick={() => setShowNewCostModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateCost} className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                      <input 
                        type="text" 
                        required
                        value={newCost.description}
                        onChange={e => setNewCost({...newCost, description: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                        placeholder="Ex: Compra de materiais elétricos"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
                        <input 
                          type="number" 
                          required
                          value={newCost.amount}
                          onChange={e => setNewCost({...newCost, amount: Number(e.target.value)})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                        <input 
                          type="date" 
                          required
                          value={newCost.date}
                          onChange={e => setNewCost({...newCost, date: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fornecedor</label>
                        <input 
                          type="text" 
                          value={newCost.supplier}
                          onChange={e => setNewCost({...newCost, supplier: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Categoria</label>
                        <select 
                          value={newCost.categoryId}
                          onChange={e => setNewCost({...newCost, categoryId: e.target.value as CostCategory})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                        >
                          {budgetCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setShowNewCostModal(false)}
                        className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20"
                      >
                        Salvar Lançamento
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}

            {showNewMeasurementModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <h3 className="text-lg font-bold text-slate-900">Nova Medição</h3>
                    <button onClick={() => setShowNewMeasurementModal(false)} className="text-slate-400 hover:text-slate-600">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleCreateMeasurement} className="p-6 space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Descrição</label>
                      <input 
                        type="text" 
                        required
                        value={newMeasurement.description}
                        onChange={e => setNewMeasurement({...newMeasurement, description: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                        placeholder="Ex: Medição ref. Março/2024"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Valor (R$)</label>
                        <input 
                          type="number" 
                          required
                          value={newMeasurement.amount}
                          onChange={e => setNewMeasurement({...newMeasurement, amount: Number(e.target.value)})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
                        <input 
                          type="date" 
                          required
                          value={newMeasurement.date}
                          onChange={e => setNewMeasurement({...newMeasurement, date: e.target.value})}
                          className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Status</label>
                      <select 
                        value={newMeasurement.status}
                        onChange={e => setNewMeasurement({...newMeasurement, status: e.target.value as any})}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                      >
                        <option value="Pending">Pendente</option>
                        <option value="Invoiced">Faturado</option>
                        <option value="Received">Recebido</option>
                      </select>
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button 
                        type="button"
                        onClick={() => setShowNewMeasurementModal(false)}
                        className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all"
                      >
                        Cancelar
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold hover:bg-brand-blue-light transition-all shadow-lg shadow-brand-blue/20"
                      >
                        Salvar Medição
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 sticky top-0 h-screen">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-white rounded-lg">
              <img src="https://storage.googleapis.com/static.antigravity.ai/projects/0cb2512f-4ddd-48fb-a3e3-9bcb8f848bdf/logo.png" className="w-8 h-auto" alt="MPS Logo" referrerPolicy="no-referrer" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">MPS</h2>
              <p className="text-[10px] text-brand-orange font-bold uppercase tracking-wider">Industrial ERP</p>
            </div>
          </div>

          <nav className="space-y-2">
            <SidebarItem 
              icon={LayoutDashboard} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarItem 
              icon={Briefcase} 
              label="Projetos" 
              active={activeTab === 'projects'} 
              onClick={() => setActiveTab('projects')} 
            />
            <SidebarItem 
              icon={Calculator} 
              label="Orçamentos" 
              active={activeTab === 'budgeting'} 
              onClick={() => setActiveTab('budgeting')} 
            />
            <SidebarItem 
              icon={Database} 
              label="Recursos" 
              active={activeTab === 'resources'} 
              onClick={() => setActiveTab('resources')} 
            />
            <SidebarItem 
              icon={Calendar} 
              label="Cronograma" 
              active={activeTab === 'schedule'} 
              onClick={() => setActiveTab('schedule')} 
            />
            <SidebarItem 
              icon={DollarSign} 
              label="Custos Reais" 
              active={activeTab === 'costs'} 
              onClick={() => setActiveTab('costs')} 
            />
            <SidebarItem 
              icon={TrendingUp} 
              label="EVM / Performance" 
              active={activeTab === 'evm'} 
              onClick={() => setActiveTab('evm')} 
            />
            <SidebarItem 
              icon={FileText} 
              label="Medições" 
              active={activeTab === 'measurements'} 
              onClick={() => setActiveTab('measurements')} 
            />
            <SidebarItem 
              icon={TrendingUp} 
              label="Fluxo de Caixa" 
              active={activeTab === 'cashflow'} 
              onClick={() => setActiveTab('cashflow')} 
            />
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border-2 border-brand-blue" alt={user.displayName || ''} />
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.displayName}</p>
              <p className="text-xs text-slate-400 truncate">{profile?.role || 'Usuário'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center w-full gap-3 px-4 py-2 text-sm font-medium text-rose-400 transition-colors rounded-lg hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="w-4 h-4" />
            Sair do Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-slate-900 capitalize">{activeTab}</h2>
            <div className="h-6 w-px bg-slate-200 mx-2"></div>
            <select 
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-brand-blue focus:border-brand-blue block w-full p-2"
            >
              <option value="all">Consolidado Grupo</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Buscar projeto..." 
                className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue w-64"
              />
            </div>
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard 
                    label="Receita Total" 
                    value={formatCurrency(dashboardStats.totalRevenue)} 
                    trend="up" 
                    trendValue="12.5%" 
                    icon={DollarSign} 
                    color="bg-brand-blue" 
                  />
                  <StatCard 
                    label="Custos Totais" 
                    value={formatCurrency(dashboardStats.totalActualCost)} 
                    trend="down" 
                    trendValue="3.2%" 
                    icon={BarChart3} 
                    color="bg-slate-800" 
                  />
                  <StatCard 
                    label="Lucro Líquido" 
                    value={formatCurrency(dashboardStats.profit)} 
                    trend="up" 
                    trendValue="8.1%" 
                    icon={TrendingUp} 
                    color="bg-blue-600" 
                  />
                  <StatCard 
                    label="Margem Média" 
                    value={formatPercent(dashboardStats.margin)} 
                    trend="up" 
                    trendValue="2.4%" 
                    icon={PieChart} 
                    color="bg-violet-600" 
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* S-Curve Chart */}
                  <Card className="lg:col-span-2" title="Curva S - Planejado vs Real" subtitle="Acompanhamento físico-financeiro consolidado">
                    <div className="h-[400px] w-full mt-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={[
                            { month: 'Jan', planned: 4000, actual: 2400 },
                            { month: 'Fev', planned: 3000, actual: 1398 },
                            { month: 'Mar', planned: 2000, actual: 9800 },
                            { month: 'Abr', planned: 2780, actual: 3908 },
                            { month: 'Mai', planned: 1890, actual: 4800 },
                            { month: 'Jun', planned: 2390, actual: 3800 },
                            { month: 'Jul', planned: 3490, actual: 4300 },
                          ]}
                        >
                          <defs>
                            <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0f172a" stopOpacity={0.1}/>
                              <stop offset="95%" stopColor="#0f172a" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} tickFormatter={(v) => `R$${v/1000}k`} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="top" align="right" iconType="circle" />
                          <Area type="monotone" dataKey="planned" name="Planejado" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorPlanned)" />
                          <Area type="monotone" dataKey="actual" name="Realizado" stroke="#0f172a" strokeWidth={3} fillOpacity={1} fill="url(#colorActual)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  {/* KPI List */}
                  <Card title="Indicadores de Performance" subtitle="EVM & KPIs Operacionais">
                    <div className="space-y-6 mt-4">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-500">CPI (Custo)</span>
                          <span className="text-sm font-bold text-brand-blue">1.05</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-brand-orange h-2 rounded-full" style={{ width: '85%' }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Performance acima do planejado</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-500">SPI (Prazo)</span>
                          <span className="text-sm font-bold text-amber-600">0.92</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-amber-500 h-2 rounded-full" style={{ width: '72%' }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Atraso leve detectado</p>
                      </div>

                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-500">Avanço Físico Global</span>
                          <span className="text-sm font-bold text-blue-600">64%</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: '64%' }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 uppercase font-bold">Média ponderada do grupo</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Projects Table */}
                <Card title="Projetos Ativos" subtitle="Visão executiva de contratos em andamento">
                  <div className="overflow-x-auto mt-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Projeto</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Empresa</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Status</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Progresso</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Resultado</th>
                          <th className="pb-4 font-semibold text-slate-500 text-sm">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {projects.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 italic">Nenhum projeto cadastrado</td>
                          </tr>
                        ) : projects.map(p => (
                          <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="py-4">
                              <div>
                                <p className="font-bold text-slate-900">{p.name}</p>
                                <p className="text-xs text-slate-500">{p.client}</p>
                              </div>
                            </td>
                            <td className="py-4">
                              <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-600">
                                {companies.find(c => c.id === p.companyId)?.name || 'N/A'}
                              </span>
                            </td>
                            <td className="py-4">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  p.status === 'Active' ? "bg-brand-orange" : "bg-slate-300"
                                )}></div>
                                <span className="text-sm text-slate-600">{p.status}</span>
                              </div>
                            </td>
                            <td className="py-4">
                              <div className="w-32">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] font-bold text-slate-400">45%</span>
                                </div>
                                <div className="w-full bg-slate-100 rounded-full h-1.5">
                                  <div className="bg-brand-orange h-1.5 rounded-full" style={{ width: '45%' }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="py-4">
                              <p className="text-sm font-bold text-brand-blue">+ R$ 45.200</p>
                            </td>
                            <td className="py-4">
                              <button 
                                onClick={() => {
                                  setSelectedProjectId(p.id);
                                  setActiveTab('projects');
                                }}
                                className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/5 rounded-lg transition-all"
                              >
                                <ChevronRight className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'projects' && (
              <motion.div 
                key="projects"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestão de Projetos</h2>
                    <p className="text-slate-500">Controle técnico e executivo de obras</p>
                  </div>
                  <button 
                    onClick={() => setShowNewProjectModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold hover:bg-brand-blue-light transition-all shadow-lg shadow-brand-blue/20"
                  >
                    <Plus className="w-5 h-5" />
                    Novo Projeto
                  </button>
                </div>

                {showNewProjectModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
                    >
                      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <h3 className="text-lg font-bold text-slate-900">Novo Projeto</h3>
                        <button onClick={() => setShowNewProjectModal(false)} className="text-slate-400 hover:text-slate-600">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                      <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nome do Projeto</label>
                          <input 
                            type="text" 
                            required
                            value={newProject.name}
                            onChange={e => setNewProject({...newProject, name: e.target.value})}
                            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                            placeholder="Ex: Reforma Ponte Rolante 50t"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Empresa</label>
                            <select 
                              required
                              value={newProject.companyId}
                              onChange={e => setNewProject({...newProject, companyId: e.target.value})}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                            >
                              <option value="">Selecione...</option>
                              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cliente</label>
                            <input 
                              type="text" 
                              required
                              value={newProject.client}
                              onChange={e => setNewProject({...newProject, client: e.target.value})}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                              placeholder="Nome do Cliente"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Início</label>
                            <input 
                              type="date" 
                              required
                              value={newProject.startDate}
                              onChange={e => setNewProject({...newProject, startDate: e.target.value})}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data Fim</label>
                            <input 
                              type="date" 
                              required
                              value={newProject.endDate}
                              onChange={e => setNewProject({...newProject, endDate: e.target.value})}
                              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue outline-none"
                            />
                          </div>
                        </div>
                        <div className="pt-4 flex gap-3">
                          <button 
                            type="button"
                            onClick={() => setShowNewProjectModal(false)}
                            className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all"
                          >
                            Cancelar
                          </button>
                          <button 
                            type="submit"
                            className="flex-1 px-4 py-2 bg-brand-blue text-white rounded-lg font-bold hover:bg-brand-blue-light transition-all shadow-lg shadow-brand-blue/20"
                          >
                            Criar Projeto
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map(p => (
                    <div key={p.id}>
                      <Card 
                        className="hover:border-brand-blue/20 transition-all cursor-pointer group"
                        onClick={() => setSelectedProjectId(p.id)}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="p-3 bg-slate-100 rounded-xl group-hover:bg-brand-blue/5 transition-colors">
                            <Briefcase className="w-6 h-6 text-slate-600 group-hover:text-brand-blue" />
                          </div>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded",
                            p.status === 'Active' ? "bg-brand-blue/10 text-brand-blue" : "bg-slate-100 text-slate-600"
                          )}>
                            {p.status}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">{p.name}</h3>
                        <p className="text-sm text-slate-500 mb-4">{p.client}</p>
                        
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Empresa</span>
                            <span className="font-bold text-slate-700">{companies.find(c => c.id === p.companyId)?.name}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Início</span>
                            <span className="font-bold text-slate-700">{p.startDate}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Fim Previsto</span>
                            <span className="font-bold text-slate-700">{p.endDate}</span>
                          </div>
                        </div>

                        <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-between">
                          <div className="flex -space-x-2">
                            {[1,2,3].map(i => (
                              <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                U{i}
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-1 text-brand-blue font-bold text-sm">
                            Ver Detalhes
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === 'budgeting' && (
              <motion.div 
                key="budgeting"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestão de Orçamentos</h2>
                    <p className="text-slate-500">Consolidado de orçamentos por projeto e empresa</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <Card title="Resumo de Orçamentos" subtitle="Visão geral de custos orçados por projeto">
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Projeto</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Empresa</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Custo Direto</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">BDI (%)</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Preço de Venda</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projects.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 italic">Nenhum projeto cadastrado</td>
                            </tr>
                          ) : projects.map(p => {
                            const projectBudget = allBudgetLines.filter(b => b.projectId === p.id);
                            const directCost: number = projectBudget.reduce((acc: number, b: BudgetLine) => {
                              const resource = allResources.find(r => r.id === b.resourceId);
                              const isLabor = resource?.category === 'Mão de obra direta' || resource?.category === 'Mão de obra indireta';
                              const costWithSocialCharges = isLabor ? b.totalCost * (1 + (p.bdi?.socialCharges || 0) / 100) : b.totalCost;
                              return acc + costWithSocialCharges;
                            }, 0);
                            
                            const sellingPrice: number = projectBudget.reduce((acc: number, b: BudgetLine) => {
                              const resource = allResources.find(r => r.id === b.resourceId);
                              return acc + calculateSellingPrice(b.totalCost, p.bdi || { centralAdmin: 0, risk: 0, guarantees: 0, financialExpenses: 0, taxes: 0, socialCharges: 0, profit: 0 }, resource?.category, b.bdiOverride);
                            }, 0);

                            const bdiTotal: number = (
                              (p.bdi?.centralAdmin || 0) +
                              (p.bdi?.risk || 0) +
                              (p.bdi?.guarantees || 0) +
                              (p.bdi?.financialExpenses || 0) +
                              (p.bdi?.taxes || 0) +
                              (p.bdi?.profit || 0)
                            );

                            return (
                              <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="py-4">
                                  <p className="font-bold text-slate-900">{p.name}</p>
                                  <p className="text-xs text-slate-500">{p.client}</p>
                                </td>
                                <td className="py-4">
                                  <span className="text-xs font-bold px-2 py-1 bg-slate-100 rounded text-slate-600">
                                    {companies.find(c => c.id === p.companyId)?.name || 'N/A'}
                                  </span>
                                </td>
                                <td className="py-4 text-right font-medium">{formatCurrency(directCost)}</td>
                                <td className="py-4 text-right font-medium text-slate-500">{bdiTotal.toFixed(2)}%</td>
                                <td className="py-4 text-right font-bold text-brand-blue">{formatCurrency(sellingPrice)}</td>
                                <td className="py-4 text-right">
                                  <button 
                                    onClick={() => {
                                      setSelectedProjectId(p.id);
                                      setActiveTab('project-budget');
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                                  >
                                    Ver Detalhes
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'resources' && (
              <motion.div 
                key="resources"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ResourceManagement 
                  resources={allResources} 
                  categories={budgetCategories} 
                  companyId={selectedCompanyId === 'all' ? (companies[0]?.id || '') : selectedCompanyId} 
                />
              </motion.div>
            )}

            {activeTab === 'costs' && (
              <motion.div 
                key="costs"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestão de Custos Reais</h2>
                    <p className="text-slate-500">Acompanhamento de despesas e custos incorridos por projeto</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <Card title="Resumo de Custos" subtitle="Comparativo entre orçado e realizado">
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Projeto</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Custo Orçado</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Custo Real</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Desvio</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Status</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projects.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 italic">Nenhum projeto cadastrado</td>
                            </tr>
                          ) : projects.map(p => {
                            const projectBudget = allBudgetLines.filter(b => b.projectId === p.id);
                            const budgetedCost = projectBudget.reduce((acc: number, b: BudgetLine) => acc + b.totalCost, 0);
                            const actualCost = allActualCosts.filter(c => c.projectId === p.id).reduce((acc: number, c: ActualCost) => acc + c.amount, 0);
                            const variance = budgetedCost - actualCost;
                            const isOverBudget = actualCost > budgetedCost && budgetedCost > 0;

                            return (
                              <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="py-4">
                                  <p className="font-bold text-slate-900">{p.name}</p>
                                  <p className="text-xs text-slate-500">{p.client}</p>
                                </td>
                                <td className="py-4 text-right font-medium">{formatCurrency(budgetedCost)}</td>
                                <td className="py-4 text-right font-bold text-slate-900">{formatCurrency(actualCost)}</td>
                                <td className="py-4 text-right font-medium">
                                  <span className={cn(variance >= 0 ? "text-brand-blue" : "text-rose-600")}>
                                    {formatCurrency(variance)}
                                  </span>
                                </td>
                                <td className="py-4 text-right">
                                  <span className={cn(
                                    "text-[10px] font-bold uppercase px-2 py-1 rounded",
                                    isOverBudget ? "bg-rose-100 text-rose-700" : "bg-brand-blue/10 text-brand-blue"
                                  )}>
                                    {isOverBudget ? 'Acima do Orçado' : 'Dentro do Orçado'}
                                  </span>
                                </td>
                                <td className="py-4 text-right">
                                  <button 
                                    onClick={() => {
                                      setSelectedProjectId(p.id);
                                      setActiveTab('project-costs');
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                                  >
                                    Ver Detalhes
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'measurements' && (
              <motion.div 
                key="measurements"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Gestão de Medições e Faturamento</h2>
                    <p className="text-slate-500">Controle de faturamento e recebíveis por projeto</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <Card title="Resumo de Faturamento" subtitle="Acompanhamento de medições realizadas e recebidas">
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Projeto</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Total Medido</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Total Recebido</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">A Receber</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Progresso Fin.</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projects.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 italic">Nenhum projeto cadastrado</td>
                            </tr>
                          ) : projects.map(p => {
                            const projectMeasurements = allMeasurements.filter(m => m.projectId === p.id);
                            const totalMeasured: number = projectMeasurements.reduce((acc: number, m: Measurement) => acc + m.amount, 0);
                            const totalReceived: number = projectMeasurements.filter(m => m.status === 'Received').reduce((acc: number, m: Measurement) => acc + m.amount, 0);
                            const toReceive = totalMeasured - totalReceived;
                            
                            const projectBudget = allBudgetLines.filter(b => b.projectId === p.id);
                            const sellingPrice: number = projectBudget.reduce((acc: number, b: BudgetLine) => {
                              const resource = allResources.find(r => r.id === b.resourceId);
                              return acc + calculateSellingPrice(b.totalCost, p.bdi || { centralAdmin: 0, risk: 0, guarantees: 0, financialExpenses: 0, taxes: 0, socialCharges: 0, profit: 0 }, resource?.category, b.bdiOverride);
                            }, 0);
                            
                            const billingProgress = sellingPrice > 0 ? (totalMeasured / sellingPrice) * 100 : 0;

                            return (
                              <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="py-4">
                                  <p className="font-bold text-slate-900">{p.name}</p>
                                  <p className="text-xs text-slate-500">{p.client}</p>
                                </td>
                                <td className="py-4 text-right font-medium">{formatCurrency(totalMeasured)}</td>
                                <td className="py-4 text-right font-bold text-brand-blue">{formatCurrency(totalReceived)}</td>
                                <td className="py-4 text-right font-medium text-amber-600">{formatCurrency(toReceive)}</td>
                                <td className="py-4 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-bold text-slate-600">{billingProgress.toFixed(1)}%</span>
                                    <div className="w-24 bg-slate-100 rounded-full h-1.5">
                                      <div className="bg-brand-orange h-1.5 rounded-full" style={{ width: `${billingProgress}%` }}></div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 text-right">
                                  <button 
                                    onClick={() => {
                                      setSelectedProjectId(p.id);
                                      setActiveTab('project-measurements');
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                                  >
                                    Ver Detalhes
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'evm' && (
              <motion.div 
                key="evm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Performance e EVM (Earned Value Management)</h2>
                    <p className="text-slate-500">Análise de valor agregado e indicadores de eficiência</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <Card title="Indicadores de Performance por Projeto" subtitle="CPI, SPI e Desvios de Cronograma/Custo">
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Projeto</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-center">CPI (Custo)</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-center">SPI (Prazo)</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Valor Agregado (EV)</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Custo Real (AC)</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projects.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 italic">Nenhum projeto cadastrado</td>
                            </tr>
                          ) : projects.map(p => {
                            // Mocking EV for now as we don't have physical progress tracking yet
                            // In a real app, EV = % physical progress * BAC
                            const projectBudget = allBudgetLines.filter(b => b.projectId === p.id);
                            const bac = projectBudget.reduce((acc: number, b: BudgetLine) => acc + b.totalCost, 0);
                            const ac = allActualCosts.filter(c => c.projectId === p.id).reduce((acc: number, c: ActualCost) => acc + c.amount, 0);
                            
                            // Mock progress 45%
                            const progress = 0.45;
                            const ev = bac * progress;
                            
                            const cpi = ac > 0 ? ev / ac : 1;
                            const spi = 0.95; // Mock SPI

                            return (
                              <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="py-4">
                                  <p className="font-bold text-slate-900">{p.name}</p>
                                  <p className="text-xs text-slate-500">{p.client}</p>
                                </td>
                                <td className="py-4 text-center">
                                  <span className={cn(
                                    "font-bold px-2 py-1 rounded text-sm",
                                    cpi >= 1 ? "text-brand-blue bg-brand-blue/5" : "text-rose-600 bg-rose-50"
                                  )}>
                                    {cpi.toFixed(2)}
                                  </span>
                                </td>
                                <td className="py-4 text-center">
                                  <span className={cn(
                                    "font-bold px-2 py-1 rounded text-sm",
                                    spi >= 1 ? "text-brand-blue bg-brand-blue/5" : "text-amber-600 bg-amber-50"
                                  )}>
                                    {spi.toFixed(2)}
                                  </span>
                                </td>
                                <td className="py-4 text-right font-medium">{formatCurrency(ev)}</td>
                                <td className="py-4 text-right font-medium">{formatCurrency(ac)}</td>
                                <td className="py-4 text-right">
                                  <button 
                                    onClick={() => {
                                      setSelectedProjectId(p.id);
                                      setActiveTab('project-evm');
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                                  >
                                    Análise
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'schedule' && (
              <motion.div 
                key="schedule"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Cronograma e Prazos</h2>
                    <p className="text-slate-500">Acompanhamento de marcos e entregas contratuais</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <Card title="Timeline de Projetos" subtitle="Datas de início, término e progresso temporal">
                    <div className="overflow-x-auto mt-4">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100">
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Projeto</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Data Início</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Data Fim</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Duração (Dias)</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm">Progresso Temporal</th>
                            <th className="pb-4 font-semibold text-slate-500 text-sm text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {projects.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-slate-400 italic">Nenhum projeto cadastrado</td>
                            </tr>
                          ) : projects.map(p => {
                            const start = new Date(p.startDate);
                            const end = new Date(p.endDate);
                            const now = new Date();
                            
                            const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            const elapsedDays = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                            
                            let timeProgress = (elapsedDays / totalDays) * 100;
                            timeProgress = Math.max(0, Math.min(100, timeProgress));

                            return (
                              <tr key={p.id} className="group hover:bg-slate-50/50 transition-colors">
                                <td className="py-4">
                                  <p className="font-bold text-slate-900">{p.name}</p>
                                  <p className="text-xs text-slate-500">{p.client}</p>
                                </td>
                                <td className="py-4 text-sm">{p.startDate}</td>
                                <td className="py-4 text-sm">{p.endDate}</td>
                                <td className="py-4 text-sm font-medium">{totalDays} dias</td>
                                <td className="py-4">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-[10px] font-bold text-slate-500">{timeProgress.toFixed(0)}% decorrido</span>
                                    <div className="w-32 bg-slate-100 rounded-full h-1.5">
                                      <div className={cn(
                                        "h-1.5 rounded-full",
                                        timeProgress > 90 ? "bg-rose-500" : "bg-blue-500"
                                      )} style={{ width: `${timeProgress}%` }}></div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 text-right">
                                  <button 
                                    onClick={() => {
                                      setSelectedProjectId(p.id);
                                      setActiveTab('project-schedule');
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                                  >
                                    Ver Gantt
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {activeTab === 'cashflow' && (
              <motion.div 
                key="cashflow"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">Fluxo de Caixa Projetado</h2>
                    <p className="text-slate-500">Planejamento financeiro de entradas e saídas</p>
                  </div>
                </div>
                <CashFlowModule 
                  projects={projects} 
                  allBudgetLines={allBudgetLines} 
                  allMeasurements={allMeasurements} 
                  allPlannedDisbursements={allPlannedDisbursements}
                  allResources={allResources}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
