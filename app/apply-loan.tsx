import { IconSymbol } from "@/components/ui/icon-symbol";
import { DataService } from "@/services/api";
import { Stack, useRouter } from "expo-router";
import React, { useState, useEffect, useMemo } from "react";
import {
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";

// Constants
const COLLATERAL_TYPES = [
  { label: "Land", value: "LAND", icon: "🏡" },
  { label: "Building/Property", value: "BUILDING", icon: "🏢" },
  { label: "Vehicle", value: "VEHICLE", icon: "🚗" },
  { label: "Equipment", value: "EQUIPMENT", icon: "⚙️" },
  { label: "Salary Deduction", value: "SALARY", icon: "📝" },
  { label: "Savings/Fixed Deposit", value: "SAVINGS", icon: "💰" },
  { label: "Other", value: "OTHER", icon: "📦" },
];

const REPAYMENT_MODES = [
  "Mobile Money",
  "Salary Deduction",
  "Bank Transfer",
  "Cash",
  "Check",
  "Standing Order",
];

// Helper for currency formatting
const fmt = (n: number) =>
  new Intl.NumberFormat("en-UG", {
    style: "decimal",
    minimumFractionDigits: 0,
  }).format(n || 0);

// Helper for Loan Calculations
const calculateLoanDetails = (
  principal: number,
  annualRate: number,
  months: number,
  type: "FLAT_RATE" | "REDUCING_BALANCE",
) => {
  if (type === "FLAT_RATE") {
    const totalInterest = principal * (annualRate / 100) * (months / 12);
    const totalAmountDue = principal + totalInterest;
    return {
      principal,
      interest: totalInterest,
      totalAmountDue,
      monthlyPayment: totalAmountDue / months,
    };
  } else {
    const monthlyRate = annualRate / 100 / 12;
    if (monthlyRate === 0)
      return {
        principal,
        interest: 0,
        totalAmountDue: principal,
        monthlyPayment: principal / months,
      };
    const monthlyPayment =
      (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
    const totalAmountDue = monthlyPayment * months;
    return {
      principal,
      interest: totalAmountDue - principal,
      totalAmountDue,
      monthlyPayment,
    };
  }
};

export default function ApplyLoanScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);

  // Form State
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [amountApplied, setAmountApplied] = useState("0");
  const [repaymentPeriodMonths, setRepaymentPeriodMonths] = useState("12");
  const [purpose, setPurpose] = useState("");
  const [interestType, setInterestType] = useState<
    "FLAT_RATE" | "REDUCING_BALANCE"
  >("FLAT_RATE");
  const [modeOfRepayment, setModeOfRepayment] = useState("Mobile Money");
  const [employer, setEmployer] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState("Self-employed");
  const [grossMonthlyIncome, setGrossMonthlyIncome] = useState("0");
  const [netMonthlyIncome, setNetMonthlyIncome] = useState("0");
  const [collateralType, setCollateralType] = useState("OTHER");
  const [collateralValue, setCollateralValue] = useState("0");
  const [forcedSaleValue, setForcedSaleValue] = useState("0");
  const [collateralLocation, setCollateralLocation] = useState("");
  const [collateralDetails, setCollateralDetails] = useState("");
  const [guarantors, setGuarantors] = useState<any[]>([
    {
      fullName: "",
      membershipNumber: "",
      phone: "",
      relationship: "",
      monthlyIncome: "0",
    },
  ]);
  const [applyProcessingFee, setApplyProcessingFee] = useState(true);
  const [applyInsurance, setApplyInsurance] = useState(true);
  const [applyShareDeduction, setApplyShareDeduction] = useState(false);

  // Eligibility
  const [eligibility, setEligibility] = useState({
    isEligible: true,
    totalOutstanding: 0,
    reasons: [] as string[],
  });

  // UI State
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [collateralModalVisible, setCollateralModalVisible] = useState(false);
  const [repaymentModalVisible, setRepaymentModalVisible] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, productsRes] = await Promise.all([
        DataService.getUserProfile(),
        DataService.getLoanProducts(),
      ]);
      const mId = profileRes.data?.memberId;
      if (mId) {
        setMemberId(mId);
        const loansRes = await DataService.getMemberLoans(mId);
        const loans = loansRes.data?.data || [];
        const activeLoans = loans.filter((l: any) =>
          ["APPROVED", "DISBURSED", "OVERDUE"].includes(l.status),
        );
        const overdueLoans = loans.filter((l: any) => l.status === "OVERDUE");
        setEligibility({
          isEligible: overdueLoans.length === 0,
          totalOutstanding: activeLoans.reduce(
            (sum: number, l: any) => sum + (l.outstandingBalance || 0),
            0,
          ),
          reasons: overdueLoans.length > 0 ? ["Clear overdue loans first"] : [],
        });
      }
      const pData = Array.isArray(productsRes.data)
        ? productsRes.data
        : productsRes.data?.data || [];
      setProducts(pData);
      if (pData.length > 0) {
        setSelectedProduct(pData[0]);
        setInterestType(pData[0].interestType || "FLAT_RATE");
      }
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Sync Error",
        text2: "Failed to load loan data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculations = useMemo(() => {
    const principal = parseInt(amountApplied.replace(/,/g, "")) || 0;
    const months = parseInt(repaymentPeriodMonths) || 1;
    if (!principal || !selectedProduct) return null;
    const loanCalc = calculateLoanDetails(
      principal,
      selectedProduct.interestRate || 24,
      months,
      interestType,
    );
    const deductions =
      (applyProcessingFee ? principal * 0.01 : 0) +
      (applyInsurance ? principal * 0.015 : 0) +
      (applyShareDeduction ? 20000 : 0);
    return {
      ...loanCalc,
      totalDeductions: deductions,
      netDisbursement: Math.max(0, principal - deductions),
    };
  }, [
    amountApplied,
    repaymentPeriodMonths,
    selectedProduct,
    interestType,
    applyProcessingFee,
    applyInsurance,
    applyShareDeduction,
  ]);

  const handleApply = async () => {
    if (!memberId || !selectedProduct) return;
    const principal = parseInt(amountApplied.replace(/,/g, "")) || 0;
    if (
      principal < (selectedProduct.minAmount || 0) ||
      principal > (selectedProduct.maxAmount || 0)
    ) {
      Alert.alert(
        "Invalid Amount",
        `Amount must be between ${fmt(selectedProduct.minAmount)} and ${fmt(selectedProduct.maxAmount)}`,
      );
      return;
    }
    if (!eligibility.isEligible) {
      Alert.alert("Ineligible", eligibility.reasons.join(". "));
      return;
    }

    setIsSubmitting(true);
    try {
      await DataService.applyLoan({
        memberId,
        loanProductId: selectedProduct.id,
        amountApplied: principal,
        purpose,
        employer,
        employmentStatus,
        grossMonthlyIncome: parseInt(grossMonthlyIncome),
        netMonthlyIncome: parseInt(netMonthlyIncome),
        repaymentPeriodMonths: parseInt(repaymentPeriodMonths),
        modeOfRepayment,
        interestType,
        collateralType,
        collateralValue: parseInt(collateralValue),
        forcedSaleValue: parseInt(forcedSaleValue),
        collateralLocation,
        collateralDetails,
        guarantors: guarantors
          .filter((g) => g.fullName)
          .map((g) => ({ ...g, monthlyIncome: parseInt(g.monthlyIncome) })),
        applyLoanProcessingFee: applyProcessingFee,
        applyLoanInsurance: applyInsurance,
        applyShareDeduction,
        applicantDeclaration: true,
        guarantorAgreementAccepted: true,
      });
      Toast.show({
        type: "success",
        text1: "Submission Successful",
        text2: "Your application is being reviewed.",
      });
      setTimeout(() => router.back(), 2000);
    } catch (e: any) {
      Toast.show({
        type: "error",
        text1: "Submission Failed",
        text2: e.response?.data?.message || "Error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const SectionHeader = ({ num, title }: { num: string; title: string }) => (
    <View className="flex-row items-center  mb-6 px-2">
      <View className="w-8 h-8 bg-forest rounded-full items-center justify-center mr-3">
        <Text className="text-white font-black text-xs">{num}</Text>
      </View>
      <Text className="text-forest font-black uppercase tracking-widest text-xs">
        {title}
      </Text>
    </View>
  );

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-warmWhite">
        <ActivityIndicator size="large" color="#1A6B47" />
      </View>
    );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-warmWhite"
    >
      <StatusBar style="light" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Cinematic Header */}
      <View className="bg-forest pt-12 pb-8 overflow-hidden">
        <View className="absolute top-[-20px] left-[-20px] w-48 h-48 bg-mint/5 rounded-full" />
        <View className="px-6 flex-row items-center">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20"
          >
            <IconSymbol name="chevron.left" size={20} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-black tracking-tight">
            Loan Application
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 160 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Core Selection */}
        <View className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-8">
          <SectionHeader num="01" title="Product & Amount" />

          <View className="space-y-5">
            <View>
              <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                Selected Product
              </Text>
              <TouchableOpacity
                onPress={() => setProductModalVisible(true)}
                className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex-row justify-between items-center"
              >
                <Text className="text-textDark font-bold">
                  {selectedProduct?.name || "Select Product"}
                </Text>
                <IconSymbol name="chevron.down" size={16} color="#4B6558" />
              </TouchableOpacity>
            </View>

            <View>
              <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                Loan Amount (UGX)
              </Text>
              <View className="bg-gray-50 border border-gray-100 rounded-2xl p-4 flex-row items-center">
                <Text className="text-textDark font-black mr-2">UGX</Text>
                <TextInput
                  value={amountApplied}
                  onChangeText={setAmountApplied}
                  keyboardType="numeric"
                  className="flex-1 text-textDark font-black text-lg p-0"
                  placeholder="0"
                />
              </View>
              <Text className="text-textLight text-[9px] mt-2 px-1">
                Min: {fmt(selectedProduct?.minAmount)} | Max:{" "}
                {fmt(selectedProduct?.maxAmount)}
              </Text>
            </View>

            <View className="flex-row space-x-4">
              <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                  Period (Months)
                </Text>
                <TextInput
                  value={repaymentPeriodMonths}
                  onChangeText={setRepaymentPeriodMonths}
                  keyboardType="numeric"
                  className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-black text-center"
                />
              </View>
              <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                  Interest Type
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setInterestType(
                      interestType === "FLAT_RATE"
                        ? "REDUCING_BALANCE"
                        : "FLAT_RATE",
                    )
                  }
                  className="bg-leaf/5 p-4 rounded-2xl border border-leaf/10 items-center justify-center"
                >
                  <Text className="text-leaf font-black text-[10px]">
                    {interestType.split("_")[0]}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Step 2: Financial Context */}
        <View className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-8">
          <SectionHeader num="02" title="Employment & Income" />
          <View className="space-y-5">
            <View>
              <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                Employer / Business
              </Text>
              <TextInput
                value={employer}
                onChangeText={setEmployer}
                className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-bold"
                placeholder="Company Name"
              />
            </View>
            <View className="flex-row space-x-4">
              <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                  Net Monthly
                </Text>
                <TextInput
                  value={netMonthlyIncome}
                  onChangeText={setNetMonthlyIncome}
                  keyboardType="numeric"
                  className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-black"
                  placeholder="0"
                />
              </View>
              <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                  Gross Monthly
                </Text>
                <TextInput
                  value={grossMonthlyIncome}
                  onChangeText={setGrossMonthlyIncome}
                  keyboardType="numeric"
                  className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-black"
                  placeholder="0"
                />
              </View>
            </View>
          </View>
        </View>

        {/* Step 3: Security */}
        <View className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 mb-8">
          <SectionHeader num="03" title="Collateral & Security" />
          <View className="space-y-5">
            <TouchableOpacity
              onPress={() => setCollateralModalVisible(true)}
              className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex-row justify-between items-center"
            >
              <Text className="text-textDark font-bold">
                {
                  COLLATERAL_TYPES.find((t) => t.value === collateralType)
                    ?.label
                }
              </Text>
              <IconSymbol name="chevron.down" size={16} color="#4B6558" />
            </TouchableOpacity>
            <View className="flex-row space-x-4">
              <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                  Market Value
                </Text>
                <TextInput
                  value={collateralValue}
                  onChangeText={setCollateralValue}
                  keyboardType="numeric"
                  className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-black"
                />
              </View>
              <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">
                  Forced Sale
                </Text>
                <TextInput
                  value={forcedSaleValue}
                  onChangeText={setForcedSaleValue}
                  keyboardType="numeric"
                  className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-black"
                />
              </View>
            </View>
            <TextInput
              value={collateralLocation}
              onChangeText={setCollateralLocation}
              className="bg-gray-50 p-4 rounded-2xl border border-gray-100 font-bold"
              placeholder="Security Location"
            />
          </View>
        </View>

        {/* Summary Card - High Fidelity */}
        {calculations && (
          <View className="bg-forest rounded-[36px] p-8 mb-8 overflow-hidden shadow-2xl shadow-forest/20">
            <View className="absolute top-0 right-0 w-32 h-32 bg-mint/10 rounded-bl-full" />
            <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-6">
              Repayment Summary
            </Text>
            <View className="flex-row justify-between items-end mb-8">
              <View>
                <Text className="text-white font-black text-3xl">
                  UGX {fmt(calculations.monthlyPayment)}
                </Text>
                <Text className="text-mint text-[10px] font-black uppercase tracking-widest mt-1">
                  Estimated Monthly Payment
                </Text>
              </View>
            </View>
            <View className="space-y-3 pt-6 border-t border-white/10">
              <View className="flex-row justify-between">
                <Text className="text-white/50 text-xs">Total Interest</Text>
                <Text className="text-white font-bold text-xs">
                  {fmt(calculations.interest)}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-white/50 text-xs">Deductions</Text>
                <Text className="text-red-300 font-bold text-xs">
                  - {fmt(calculations.totalDeductions)}
                </Text>
              </View>
              <View className="flex-row justify-between pt-3 border-t border-white/5 mt-2">
                <Text className="text-gold font-black uppercase text-[10px]">
                  Net Disbursement
                </Text>
                <Text className="text-white font-black text-sm">
                  UGX {fmt(calculations.netDisbursement)}
                </Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer Submission */}
      <View className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl p-6 border-t border-gray-100 shadow-2xl">
        <TouchableOpacity
          onPress={handleApply}
          disabled={isSubmitting}
          className="bg-leaf h-16 rounded-[24px] items-center justify-center flex-row shadow-xl shadow-leaf/20"
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text className="text-white font-black text-base uppercase tracking-widest mr-4">
                Submit Application
              </Text>
              <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center">
                <IconSymbol name="arrow.right" size={16} color="white" />
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Modals - Simplified Premium Look */}
      <Modal visible={productModalVisible} transparent animationType="slide">
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-forest/40 justify-end"
          onPress={() => setProductModalVisible(false)}
        >
          <View className="bg-white rounded-t-[48px] p-8 max-h-[80%]">
            <View className="w-12 h-1.5 bg-gray-100 rounded-full self-center mb-8" />
            <Text className="text-forest text-2xl font-black mb-8 px-2">
              Loan Products
            </Text>
            <FlatList
              data={products}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setSelectedProduct(item);
                    setInterestType(item.interestType || "FLAT_RATE");
                    setProductModalVisible(false);
                  }}
                  className={`p-6 mb-4 rounded-[28px] border-2 ${selectedProduct?.id === item.id ? "border-leaf bg-leaf/5" : "border-gray-50 bg-gray-50"}`}
                >
                  <Text className="text-textDark font-black text-base mb-1">
                    {item.name}
                  </Text>
                  <Text className="text-textLight text-[10px] font-black uppercase tracking-widest">
                    Rate: {item.interestRate}% • {item.interestType}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={collateralModalVisible} transparent animationType="slide">
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-forest/40 justify-end"
          onPress={() => setCollateralModalVisible(false)}
        >
          <View className="bg-white rounded-t-[48px] p-8 max-h-[80%]">
            <View className="w-12 h-1.5 bg-gray-100 rounded-full self-center mb-8" />
            <Text className="text-forest text-2xl font-black mb-8 px-2">
              Collateral Type
            </Text>
            <FlatList
              data={COLLATERAL_TYPES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setCollateralType(item.value);
                    setCollateralModalVisible(false);
                  }}
                  className="p-6 mb-3 rounded-[28px] bg-gray-50 flex-row items-center"
                >
                  <Text className="text-2xl mr-4">{item.icon}</Text>
                  <Text className="text-textDark font-black text-base">
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}
