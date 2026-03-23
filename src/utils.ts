import { BDIConfig, BudgetLine, ScheduleTask, ActualCost } from './types';

/**
 * Preço venda = Custo total / (1 - BDI)
 * BDI = (centralAdmin + risk + guarantees + financialExpenses + taxes + profit) / 100
 */
export function calculateSellingPrice(cost: number, bdi: BDIConfig, category?: string, bdiOverride?: number) {
  // Apply social charges if it's labor
  const isLabor = category === 'Mão de obra direta' || category === 'Mão de obra indireta';
  const costWithSocialCharges = isLabor ? cost * (1 + bdi.socialCharges / 100) : cost;

  // Use override if provided, otherwise calculate from BDI config
  const bdiTotal = bdiOverride !== undefined ? bdiOverride / 100 : (
    bdi.centralAdmin +
    bdi.risk +
    bdi.guarantees +
    bdi.financialExpenses +
    bdi.taxes +
    bdi.profit
  ) / 100;
  
  if (bdiTotal >= 1) return costWithSocialCharges * 2; // Safety fallback
  return costWithSocialCharges / (1 - bdiTotal);
}

export function calculateEVM(tasks: ScheduleTask[]) {
  const pv = tasks.reduce((acc, t) => acc + (t.plannedValue || 0), 0);
  const ev = tasks.reduce((acc, t) => acc + (t.earnedValue || 0), 0);
  const ac = tasks.reduce((acc, t) => acc + (t.actualCost || 0), 0);

  const cpi = ac > 0 ? ev / ac : 0;
  const spi = pv > 0 ? ev / pv : 0;

  return { pv, ev, ac, cpi, spi };
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: 2,
  }).format(value / 100);
}
