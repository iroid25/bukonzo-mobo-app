// Shared shapes for the data layer. The dashboard, profile, deposit, withdraw
// and loan screens all consume `UserData` as produced by
// `DataService.getUserProfile()`.

export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'WITHDRAWAL';
  amount: number;
  date: string;
  description: string;
  status: string;
}

export interface Account {
  id: string;
  title: string;
  accNo: string;
  balance: number;
  type: string;
}

export interface UserData {
  name: string;
  email: string;
  memberId?: string;
  memberNumber?: string | null;
  membershipStatus?: string | null;
  phone?: string | null;
  address?: string | null;
  dateOfBirth?: string | null;
  nin?: string | null;
  branchName?: string | null;
  totalBalance: number;
  accounts: Account[];
  transactions: any[];
  activeLoan?: {
    type: string;
    amount: number;
    outstanding: number;
    nextPaymentDate: string;
    nextPaymentAmount: number;
    progress: number; // 0-1
  };
  image?: string;
  joinedDate?: string;
  loanStats?: {
    repaidCount: number;
  };
}
