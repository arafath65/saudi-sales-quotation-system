"use client";
import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import QuotationBankTermsSelector, {
  type QuotationOptionsSelection,
} from "@/components/quotations/QuotationBankTermsSelector";
type Customer = {
  id: number;
  customerCode: string;
  name: string;
  mobile: string;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  nationality: string | null;
  passportNo: string | null;
  iqamaNo?: string | null;
  isActive: boolean;
};
type Route = {
  id: number;
  name: string;
  isActive: boolean;
};
type VehicleType = {
  id: number;
  name: string;
  seatCount: number | null;
  isActive: boolean;
};
type HotelRoomType = {
  id: number;
  name: string;
  isActive: boolean;
};
type HotelStayDuration = {
  id: number;
  days: number;
  isActive: boolean;
};
type Airline = {
  id: number;
  name: string;
  isActive: boolean;
};
type Currency = "SAR" | "LKR" | "USD";

type ServiceType =
  | "UMRAH_VISA"
  | "RAWDHA"
  | "HOTEL_ACCOMMODATION"
  | "AIR_TICKET"
  | "TRANSPORTATION";
type QuotationItem = {
  id: string;
  serviceType: ServiceType;
  visaType: string;
  hotelName: string;
  roomType: string;
  numberOfDays: string;
  acType: string;
  boardType: string;
  ticketType: string;
  airlineName: string;
  baggageWeightKg: string;
  adultPrice: string;
  adultQuantity: string;
  childPrice: string;
  childQuantity: string;
  infantPrice: string;
  infantQuantity: string;
  routeId: string;
  vehicleTypeId: string;
  amount: string;
  quantity: string;
  discount: string;
};
const SERVICE_LABELS: Record<
  ServiceType,
  string
> = {
  UMRAH_VISA: "Umrah Visa",
  RAWDHA: "Rawdha",
  HOTEL_ACCOMMODATION: "Hotel Accommodation",
  AIR_TICKET: "Air Ticket",
  TRANSPORTATION: "Transportation",
};
function newItem(
  serviceType: ServiceType
): QuotationItem {
  return {
    id: crypto.randomUUID(),
    serviceType,
    visaType: "GROUP",
    hotelName: "",
    roomType: "",
    numberOfDays: "",
    acType: "AC",
    boardType: "ROOM_ONLY",
    ticketType: "ONE_WAY",
    airlineName: "",
    baggageWeightKg: "",
    adultPrice: "",
    adultQuantity: "0",
    childPrice: "",
    childQuantity: "0",
    infantPrice: "",
    infantQuantity: "0",
    routeId: "",
    vehicleTypeId: "",
    amount: "",
    quantity: "1",
    discount: "0",
  };
}
function calculateTicketSubtotal(item: QuotationItem) {
  return (Number(item.adultPrice) || 0) * (Number(item.adultQuantity) || 0)
    + (Number(item.childPrice) || 0) * (Number(item.childQuantity) || 0)
    + (Number(item.infantPrice) || 0) * (Number(item.infantQuantity) || 0);
}
function buildTicketBreakdown(item: QuotationItem, currency: Currency = "SAR") {
  const parts: string[] = [];
  const categories = [
    { label: "Adult", price: item.adultPrice, quantity: item.adultQuantity },
    { label: "Child", price: item.childPrice, quantity: item.childQuantity },
    { label: "Infant", price: item.infantPrice, quantity: item.infantQuantity },
  ];
  for (const category of categories) {
    const quantity = Number(category.quantity) || 0;
    if (quantity > 0) {
      parts.push(
  `${category.label}: ${currency} ${formatMoney(category.price)} × ${formatNumber(quantity)}`
);
    }
  }
  return parts.join(" · ");
}
function buildTicketDescription(item: QuotationItem, currency: Currency = "SAR") {
  const ticketLabel = item.ticketType === "RETURN" ? "Return Ticket" : "One Way Ticket";
  const baggageLabel = item.baggageWeightKg.trim() !== ""
    ? `Baggage ${formatNumber(item.baggageWeightKg)} kg`
    : "";
  const breakdown = buildTicketBreakdown(item, currency);
  return [item.airlineName.trim(), ticketLabel, baggageLabel, breakdown]
    .filter(Boolean)
    .join(" · ");
}
function getTicketValidationError(item: QuotationItem): string {
  if (!item.airlineName.trim()) {
    return "Please select an airline.";
  }
  if (item.baggageWeightKg.trim() !== "") {
    const baggageWeight = Number(item.baggageWeightKg);
    if (
      !Number.isFinite(baggageWeight) ||
      baggageWeight < 0 ||
      baggageWeight > 9999.99
    ) {
      return "Baggage weight must be a valid non-negative weight in kg.";
    }
  }
  const categories = [
    { label: "Adult", price: item.adultPrice, quantity: item.adultQuantity },
    { label: "Child", price: item.childPrice, quantity: item.childQuantity },
    { label: "Infant", price: item.infantPrice, quantity: item.infantQuantity },
  ];
  let hasPassenger = false;
  for (const category of categories) {
    const quantity = Number(category.quantity);
    const price = Number(category.price);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return `${category.label} quantity must be a non-negative whole number.`;
    }
    if (category.price.trim() !== "" && (!Number.isFinite(price) || price < 0)) {
      return `${category.label} price cannot be negative.`;
    }
    if (quantity > 0) {
      hasPassenger = true;
      if (category.price.trim() === "" || !Number.isFinite(price) || price < 0) {
        return `Please enter a valid ${category.label.toLowerCase()} ticket price.`;
      }
    }
  }
  return hasPassenger ? "" : "Enter a quantity for at least one adult, child, or infant.";
}
function calculateItemTotal(item: QuotationItem) {
  const amount = Number(item.amount) || 0;
  const quantity = Number(item.quantity) || 0;
  const discount = Number(item.discount) || 0;
  if (item.serviceType === "AIR_TICKET") {
    return Math.max(0, calculateTicketSubtotal(item) - discount);
  }
  const numberOfDays =
    item.serviceType === "HOTEL_ACCOMMODATION"
      ? Number(item.numberOfDays) || 0
      : 1;
  return Math.max(0, amount * quantity * numberOfDays - discount);
}
function formatMoney(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0.00";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
function formatNumber(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(amount);
}
function colomboDateInputValue(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find(
    (part) => part.type === "year"
  )?.value;

  const month = parts.find(
    (part) => part.type === "month"
  )?.value;

  const day = parts.find(
    (part) => part.type === "day"
  )?.value;

  if (!year || !month || !day) return "";

  return `${year}-${month}-${day}`;
}

function getDefaultValidUntil() {
  const date = new Date(
    `${colomboDateInputValue()}T00:00:00.000Z`
  );

  date.setUTCDate(date.getUTCDate() + 7);

  return date.toISOString().slice(0, 10);
}
export default function NewQuotationPage() {
  const router = useRouter();
  const [customers, setCustomers] =
    useState<Customer[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicleTypes, setVehicleTypes] =
    useState<VehicleType[]>([]);
  const [hotelRoomTypes, setHotelRoomTypes] =
    useState<HotelRoomType[]>([]);
  const [hotelStayDurations, setHotelStayDurations] =
    useState<HotelStayDuration[]>([]);
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] =
    useState("");
    const [currency, setCurrency] = useState<Currency>("SAR");
  const [customerSearch, setCustomerSearch] =
    useState("");
  const [showCustomerResults, setShowCustomerResults] =
    useState(false);
  const customerSearchContainerRef =
  useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<
    QuotationItem[]
  >([]);
  const [quotationOptions, setQuotationOptions] =
  useState<QuotationOptionsSelection>({
    selectedBankIds: [],
    termsConditionSelections: [],
  });
  const [itemModalOpen, setItemModalOpen] =
    useState(false);
  const [draftItem, setDraftItem] =
    useState<QuotationItem>(newItem("UMRAH_VISA"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [validUntil, setValidUntil] = useState<string>(
  () => getDefaultValidUntil()
);
  const amountRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);
  const adultPriceRef = useRef<HTMLInputElement>(null);
  const adultQuantityRef = useRef<HTMLInputElement>(null);
  const childPriceRef = useRef<HTMLInputElement>(null);
  const childQuantityRef = useRef<HTMLInputElement>(null);
  const infantPriceRef = useRef<HTMLInputElement>(null);
  const infantQuantityRef = useRef<HTMLInputElement>(null);
  function focusInput(ref: { current: HTMLInputElement | null }) {
    window.requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
  }
  function focusAmount() {
    focusInput(amountRef);
  }
  async function loadQuotationData() {
    try {
      const [
        customersResponse,
        routesResponse,
        vehiclesResponse,
        roomTypesResponse,
        stayDurationsResponse,
        airlinesResponse,
      ] = await Promise.all([
        fetch("/api/customers", { cache: "no-store" }),
        fetch("/api/routes", { cache: "no-store" }),
        fetch("/api/vehicle-types", { cache: "no-store" }),
        fetch("/api/hotel-room-types", { cache: "no-store" }),
        fetch("/api/hotel-stay-durations", { cache: "no-store" }),
        fetch("/api/airlines", { cache: "no-store" }),
      ]);
      const customersData =
        await customersResponse.json();
      const routesData =
        await routesResponse.json();
      const vehiclesData = await vehiclesResponse.json();
      const roomTypesData = await roomTypesResponse.json();
      const stayDurationsData = await stayDurationsResponse.json();
      const airlinesData = await airlinesResponse.json();
      if (
        !customersResponse.ok ||
        !customersData.success
      ) {
        throw new Error(
          customersData.message ??
            "Unable to load customers."
        );
      }
      if (
        !routesResponse.ok ||
        !routesData.success
      ) {
        throw new Error(
          routesData.message ??
            "Unable to load routes."
        );
      }
      if (!vehiclesResponse.ok || !vehiclesData.success) {
        throw new Error(
          vehiclesData.message ?? "Unable to load vehicle types."
        );
      }
      if (!roomTypesResponse.ok || !roomTypesData.success) {
        throw new Error(
          roomTypesData.message ?? "Unable to load hotel room types."
        );
      }
      if (!stayDurationsResponse.ok || !stayDurationsData.success) {
        throw new Error(
          stayDurationsData.message ?? "Unable to load hotel stay durations."
        );
      }
      if (!airlinesResponse.ok || !airlinesData.success) {
        throw new Error(
          airlinesData.message ?? "Unable to load airlines."
        );
      }
      setCustomers(
        customersData.customers.filter(
          (customer: Customer) =>
            customer.isActive
        )
      );
      setRoutes(
        routesData.routes.filter(
          (route: Route) => route.isActive
        )
      );
      setVehicleTypes(
        vehiclesData.vehicleTypes.filter(
          (vehicle: VehicleType) => vehicle.isActive
        )
      );
      setHotelRoomTypes(
        roomTypesData.roomTypes.filter(
          (roomType: HotelRoomType) => roomType.isActive
        )
      );
      setHotelStayDurations(
        stayDurationsData.durations.filter(
          (duration: HotelStayDuration) => duration.isActive
        )
      );
      setAirlines(
        airlinesData.airlines.filter(
          (airline: Airline) => airline.isActive
        )
      );
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load quotation data."
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    // Defer the initial load out of the effect's synchronous phase so React's
    // set-state-in-effect rule does not treat the loader as a cascading update.
    const timer = window.setTimeout(() => {
      void loadQuotationData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
  if (!showCustomerResults) return;

  function handleOutsidePointerDown(event: PointerEvent) {
    const target = event.target;

    if (
      target instanceof Node &&
      customerSearchContainerRef.current &&
      !customerSearchContainerRef.current.contains(target)
    ) {
      setShowCustomerResults(false);
    }
  }

  document.addEventListener(
    "pointerdown",
    handleOutsidePointerDown
  );

  return () => {
    document.removeEventListener(
      "pointerdown",
      handleOutsidePointerDown
    );
  };
}, [showCustomerResults]);
  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (customer) =>
          String(customer.id) ===
          selectedCustomerId
      ) ?? null,
    [customers, selectedCustomerId]
  );
  const filteredCustomers = useMemo(() => {
  const query = customerSearch.trim().toLowerCase();

  const matchingCustomers = !query
    ? customers
    : customers.filter((customer) =>
        [
          customer.customerCode,
          customer.name,
          customer.mobile,
          customer.whatsapp,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query)
          )
      );

  return matchingCustomers.slice(0, 5);
}, [customers, customerSearch]);
  const grandTotal = useMemo(
    () =>
      items.reduce(
        (sum, item) =>
          sum + calculateItemTotal(item),
        0
      ),
    [items]
  );
  function selectCustomer(customer: Customer) {
    setSelectedCustomerId(
      String(customer.id)
    );
    setCustomerSearch(customer.name);
    setShowCustomerResults(false);
  }
  function openServiceModal() {
    setDraftItem(newItem("UMRAH_VISA"));
    setError("");
    setItemModalOpen(true);
  }
  function closeServiceModal() {
    if (saving) {
      return;
    }
    setItemModalOpen(false);
  }
  function updateDraft(
    field: keyof QuotationItem,
    value: string
  ) {
    setDraftItem((current) => ({
      ...current,
      [field]: value,
    }));
  }
  function changeDraftService(serviceType: ServiceType) {
    const baseItem = newItem(serviceType);
    setDraftItem({
      ...baseItem,
      id: draftItem.id,
      roomType:
        serviceType === "HOTEL_ACCOMMODATION"
          ? hotelRoomTypes[0]?.name ?? ""
          : "",
      numberOfDays:
        serviceType === "HOTEL_ACCOMMODATION"
          ? String(hotelStayDurations[0]?.days ?? "")
          : "",
    });
  }
  function addService(event: FormEvent) {
    event.preventDefault();
    const baseAmount =
      draftItem.serviceType === "AIR_TICKET"
        ? calculateTicketSubtotal(draftItem)
        : (Number(draftItem.amount) || 0) *
          (Number(draftItem.quantity) || 0) *
          (draftItem.serviceType === "HOTEL_ACCOMMODATION"
            ? Number(draftItem.numberOfDays) || 0
            : 1);
    if (draftItem.serviceType === "AIR_TICKET") {
      const ticketError = getTicketValidationError(draftItem);
      if (ticketError) {
        setError(ticketError);
        return;
      }
    } else {
      if (!draftItem.amount || Number(draftItem.amount) <= 0) {
        setError("Please enter a valid amount.");
        return;
      }
      if (!draftItem.quantity || Number(draftItem.quantity) <= 0) {
        setError("Please enter a valid quantity.");
        return;
      }
    }
    if (
      Number(draftItem.discount) < 0
    ) {
      setError(
        "Discount cannot be negative."
      );
      return;
    }
    if (
      Number(draftItem.discount) > baseAmount
    ) {
      setError(
        "Discount cannot exceed the service amount."
      );
      return;
    }
    if (draftItem.serviceType === "HOTEL_ACCOMMODATION") {
      if (!draftItem.hotelName.trim()) {
        setError("Please enter the hotel name.");
        return;
      }
      if (!draftItem.roomType) {
        setError("Please select a room type.");
        return;
      }
      if (!Number.isInteger(Number(draftItem.numberOfDays)) || Number(draftItem.numberOfDays) <= 0) {
        setError("Please select the number of days.");
        return;
      }
    }
    if (
      draftItem.serviceType ===
      "TRANSPORTATION" &&
      (!draftItem.routeId ||
        !draftItem.vehicleTypeId)
    ) {
      setError(
        "Please select a route and vehicle type."
      );
      return;
    }
    setItems((current) => [
      ...current,
      { ...draftItem },
    ]);
    setItemModalOpen(false);
    setError("");
  }
  function removeItem(id: string) {
    setItems((current) =>
      current.filter((item) => item.id !== id)
    );
  }
  function editItem(item: QuotationItem) {
    setDraftItem({ ...item });
    setItemModalOpen(true);
    setError("");
  }
  function saveEditedService(event: FormEvent) {
    event.preventDefault();
    const baseAmount =
      draftItem.serviceType === "AIR_TICKET"
        ? calculateTicketSubtotal(draftItem)
        : (Number(draftItem.amount) || 0) *
          (Number(draftItem.quantity) || 0) *
          (draftItem.serviceType === "HOTEL_ACCOMMODATION"
            ? Number(draftItem.numberOfDays) || 0
            : 1);
    if (draftItem.serviceType === "AIR_TICKET") {
      const ticketError = getTicketValidationError(draftItem);
      if (ticketError) {
        setError(ticketError);
        return;
      }
    } else if (
      Number(draftItem.amount) <= 0 ||
      Number(draftItem.quantity) <= 0
    ) {
      setError("Amount and quantity must be greater than zero.");
      return;
    }
    if (
      Number(draftItem.discount) > baseAmount
    ) {
      setError(
        "Discount cannot exceed the service amount."
      );
      return;
    }
    if (draftItem.serviceType === "HOTEL_ACCOMMODATION") {
      if (!draftItem.hotelName.trim()) {
        setError("Please enter the hotel name.");
        return;
      }
      if (!draftItem.roomType) {
        setError("Please select a room type.");
        return;
      }
      if (!Number.isInteger(Number(draftItem.numberOfDays)) || Number(draftItem.numberOfDays) <= 0) {
        setError("Please select the number of days.");
        return;
      }
    }
    if (
      draftItem.serviceType ===
        "TRANSPORTATION" &&
      (!draftItem.routeId ||
        !draftItem.vehicleTypeId)
    ) {
      setError(
        "Please select a route and vehicle type."
      );
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === draftItem.id
          ? { ...draftItem }
          : item
      )
    );
    setItemModalOpen(false);
    setError("");
  }
  async function generateQuotation() {
    if (!validUntil) {
  setError("Please select a quotation validity date.");
  return;
}

if (validUntil < colomboDateInputValue()) {
  setError("Valid Until cannot be earlier than today.");
  return;
}
    if (!selectedCustomerId) {
      setError("Please select a customer.");
      return;
    }
    if (items.length === 0) {
      setError("Please add at least one service.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      const response = await fetch("/api/quotations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
  customerId: Number(selectedCustomerId),
  currency,
  validUntil,

  selectedBankIds: quotationOptions.selectedBankIds,

  termsConditionSelections:
    quotationOptions.termsConditionSelections.filter(
      (selection) =>
        items.some(
          (item) =>
            item.serviceType === selection.serviceType
        )
    ),

  items: items.map((item) => ({
            serviceType: item.serviceType,
            visaType:
              item.serviceType === "UMRAH_VISA"
                ? item.visaType
                : undefined,
            hotelName:
              item.serviceType === "HOTEL_ACCOMMODATION"
                ? item.hotelName
                : undefined,
            roomType:
              item.serviceType === "HOTEL_ACCOMMODATION"
                ? item.roomType
                : undefined,
            numberOfDays:
              item.serviceType === "HOTEL_ACCOMMODATION"
                ? Number(item.numberOfDays)
                : undefined,
            acType:
              item.serviceType === "HOTEL_ACCOMMODATION"
                ? item.acType
                : undefined,
            boardType:
              item.serviceType === "HOTEL_ACCOMMODATION"
                ? item.boardType
                : undefined,
            ticketType:
              item.serviceType === "AIR_TICKET"
                ? item.ticketType
                : undefined,
            airlineName:
              item.serviceType === "AIR_TICKET"
                ? item.airlineName.trim()
                : undefined,
            baggageWeightKg:
              item.serviceType === "AIR_TICKET" && item.baggageWeightKg.trim() !== ""
                ? Number(item.baggageWeightKg)
                : undefined,
            description:
              item.serviceType === "AIR_TICKET"
                ? buildTicketDescription(item, currency)
                : undefined,
            adultPrice:
              item.serviceType === "AIR_TICKET" && item.adultPrice.trim() !== ""
                ? Number(item.adultPrice)
                : undefined,
            adultQuantity:
              item.serviceType === "AIR_TICKET"
                ? Number(item.adultQuantity)
                : undefined,
            childPrice:
              item.serviceType === "AIR_TICKET" && item.childPrice.trim() !== ""
                ? Number(item.childPrice)
                : undefined,
            childQuantity:
              item.serviceType === "AIR_TICKET"
                ? Number(item.childQuantity)
                : undefined,
            infantPrice:
              item.serviceType === "AIR_TICKET" && item.infantPrice.trim() !== ""
                ? Number(item.infantPrice)
                : undefined,
            infantQuantity:
              item.serviceType === "AIR_TICKET"
                ? Number(item.infantQuantity)
                : undefined,
            routeId:
              item.serviceType === "TRANSPORTATION"
                ? Number(item.routeId)
                : undefined,
            vehicleTypeId:
              item.serviceType === "TRANSPORTATION"
                ? Number(item.vehicleTypeId)
                : undefined,
            amount:
              item.serviceType === "AIR_TICKET"
                ? calculateTicketSubtotal(item)
                : Number(item.amount),
            quantity:
              item.serviceType === "AIR_TICKET"
                ? 1
                : Number(item.quantity),
            discount: Number(item.discount),
          })),
        }),
      });
      // Read the body as text first so an empty/non-JSON response
      // does not crash with "Unexpected end of JSON input".
      const responseText = await response.text();
      let data: {
        success?: boolean;
        message?: string;
        quotation?: {
          id: number;
        };
      };
      try {
        data = responseText
          ? JSON.parse(responseText)
          : {};
      } catch {
        console.error(
          "Quotation API returned non-JSON response:",
          responseText
        );
        throw new Error(
          `Quotation API returned an invalid response (HTTP ${response.status}).`
        );
      }
      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            `Unable to generate quotation (HTTP ${response.status}).`
        );
      }
      if (!data.quotation?.id) {
        throw new Error(
          "Quotation was created but no quotation ID was returned."
        );
      }
      router.push(`/quotations/${data.quotation.id}`);
    } catch (err) {
      console.error("Generate quotation error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate quotation."
      );
    } finally {
      setSaving(false);
    }
  }
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-6">
        <div className="mx-auto max-w-6xl">
          <div className="h-8 w-72 animate-pulse rounded bg-[#E4E7EC]" />
          <div className="mt-6 h-96 animate-pulse rounded-2xl bg-white" />
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
            Sales
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#1F2933]">
            New Quotation
          </h1>
          <p className="mt-2 text-sm text-[#667085]">
            Select a customer and add one or more services.
          </p>
        </div>
        <section className="mt-5 rounded-2xl border border-[#E4E7EC] bg-white p-5 shadow-sm">
  <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,620px)] sm:items-start">
    <div className="pt-1">
      <h2 className="text-sm font-bold text-[#1F2933]">
        Quotation Validity
      </h2>
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <div>
    <label
      htmlFor="currency"
      className="block text-xs font-semibold text-[#344054]"
    >
      Currency *
    </label>

    <select
      id="currency"
      value={currency}
      onChange={(event) =>
        setCurrency(event.target.value as Currency)
      }
      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
    >
      <option value="SAR">SAR — Saudi Riyal</option>
      <option value="LKR">LKR — Sri Lankan Rupee</option>
      <option value="USD">USD — US Dollar</option>
    </select>

    <p className="mt-1 text-xs leading-5 text-[#667085]">
      This quotation uses one currency throughout. No currency conversion is applied.
    </p>
  </div>

  <div>
    <label
      htmlFor="validUntil"
      className="block text-xs font-semibold text-[#344054]"
    >
      Valid Until *
    </label>

    <input
      id="validUntil"
      type="date"
      required
      min={colomboDateInputValue()}
      value={validUntil}
      onChange={(event) => setValidUntil(event.target.value)}
      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
    />
    <p className="mt-1 text-xs leading-5 text-[#667085]">
      Select the last date this quotation will be valid.
    </p>
  </div>
</div>
  </div>
</section>
        {error && !itemModalOpen && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* MAIN */}
          <section className="space-y-6">
            {/* Customer */}
            <div className="rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-bold text-[#1F2933]">
                  Customer
                </h2>
                <p className="mt-1 text-xs text-[#667085]">
                  Select an existing customer.
                </p>
              </div>
              <div
  ref={customerSearchContainerRef}
  className="relative mt-5"
>
                <label
                  htmlFor="customerSearch"
                  className="block text-sm font-semibold text-[#1F2933]"
                >
                  Customer *
                </label>
                <input
                  id="customerSearch"
                  value={
                    selectedCustomer
                      ? selectedCustomer.name
                      : customerSearch
                  }
                  onChange={(event) => {
                    setSelectedCustomerId("");
                    setCustomerSearch(
                      event.target.value
                    );
                    setShowCustomerResults(true);
                  }}
                  onFocus={() =>
                    setShowCustomerResults(true)
                  }
                  placeholder="Search name, contact, WhatsApp or code..."
                  className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                />
                {showCustomerResults &&
                  !selectedCustomerId && (
                    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-[#E4E7EC] bg-white p-2 shadow-xl">
                      {filteredCustomers.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-[#98A2B3]">
                          No active customer found.
                        </div>
                      ) : (
                        filteredCustomers.map(
                          (customer) => (
                            <button
                              key={customer.id}
                              type="button"
                              onClick={() =>
                                selectCustomer(
                                  customer
                                )
                              }
                              className="w-full rounded-lg px-3 py-3 text-left transition hover:bg-[#F7F8F6]"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-[#1F2933]">
                                  {customer.name}
                                </span>
                                <span className="text-[10px] font-bold text-[#0F6B5B]">
                                  {customer.customerCode}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#667085]">
  <span>Contact: {customer.mobile || "—"}</span>
  {customer.whatsapp && (
    <>
      <span className="mx-2 text-[#D0D5DD]">·</span>
      <span>WhatsApp: {customer.whatsapp}</span>
    </>
  )}
</p>
                            </button>
                          )
                        )
                      )}
                    </div>
                  )}
              </div>
              {selectedCustomer && (
                <div className="mt-4 rounded-xl border border-[#E4E7EC] bg-[#FAFAF8] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#1F2933]">
                        {selectedCustomer.name}
                      </p>
                      <p className="mt-1 text-xs text-[#667085]">
  <span>Contact: {selectedCustomer.mobile || "—"}</span>
  {selectedCustomer.whatsapp && (
    <>
      <span className="mx-2 text-[#D0D5DD]">·</span>
      <span>WhatsApp: {selectedCustomer.whatsapp}</span>
    </>
  )}
</p>
                      {selectedCustomer.whatsapp && (
                        <p className="mt-1 text-xs text-[#667085]">
                          WhatsApp: {selectedCustomer.whatsapp}
                        </p>
                      )}
                    </div>
                    <span className="rounded-full bg-[#0F6B5B]/10 px-3 py-1 text-[10px] font-bold text-[#0F6B5B]">
                      {selectedCustomer.customerCode}
                    </span>
                  </div>
                </div>
              )}
            </div>
            {/* Services */}
            <div className="rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-[#E4E7EC] p-6">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2933]">
                    Services
                  </h2>
                  <p className="mt-1 text-xs text-[#667085]">
                    Add multiple services to this quotation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openServiceModal}
                  className="rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0A4F44]"
                >
                  + Add Service
                </button>
              </div>
              <div className="divide-y divide-[#F0F2F4]">
                {items.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <p className="text-sm font-semibold text-[#1F2933]">
                      No services added
                    </p>
                    <p className="mt-1 text-xs text-[#98A2B3]">
                      Add Umrah Visa, Rawdha, Hotel, Air Ticket or
                      Transportation.
                    </p>
                  </div>
                ) : (
                  items.map((item, index) => {
                    const route = routes.find(
                      (value) =>
                        String(value.id) ===
                        item.routeId
                    );
                    const vehicle =
                      vehicleTypes.find(
                        (value) =>
                          String(value.id) ===
                          item.vehicleTypeId
                      );
                    return (
                      <div
                        key={item.id}
                        className="p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[#0F6B5B]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0F6B5B]">
                                {SERVICE_LABELS[
                                  item.serviceType
                                ]}
                              </span>
                              <span className="text-xs text-[#98A2B3]">
                                #{index + 1}
                              </span>
                            </div>
                            <h3 className="mt-3 text-sm font-bold text-[#1F2933]">
                              {item.serviceType ===
                                "UMRAH_VISA" &&
                                `${
                                  item.visaType ===
                                  "INDIVIDUAL_VISA"
                                    ? "Individual Visa"
                                    : item.visaType ===
                                        "HOST_UMRAH_VISA"
                                      ? "Host Umrah Visa"
                                      : "Group"
                                }`}
                              {item.serviceType ===
                                "HOTEL_ACCOMMODATION" &&
                                item.hotelName}
                              {item.serviceType === "AIR_TICKET" &&
                                `${item.airlineName || "Airline"} · ${
                                  item.ticketType === "RETURN" ? "Return" : "One Way"
                                } Ticket`}
                              {item.serviceType ===
                                "TRANSPORTATION" &&
                                `${route?.name ?? "Route"} · ${
                                  vehicle?.name ??
                                  "Vehicle"
                                }`}
                            </h3>
                            <p className="mt-1 text-xs text-[#667085]">
                              {item.serviceType ===
                                "HOTEL_ACCOMMODATION" &&
                                `${item.roomType || "Room type not selected"} · ${
                                  item.numberOfDays || "0"
                                } ${Number(item.numberOfDays) === 1 ? "day" : "days"} · ${
                                  item.acType === "AC" ? "AC" : "Non-AC"
                                } · ${
                                  item.boardType === "BED_BREAKFAST"
                                    ? "Bed & Breakfast"
                                    : "Room Only"
                                }`}
                              {item.serviceType === "AIR_TICKET" &&
                                [
                                  item.baggageWeightKg.trim() !== ""
                                    ? `Baggage ${formatNumber(item.baggageWeightKg)} kg`
                                    : "",
                                  buildTicketBreakdown(item, currency),
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              {item.serviceType ===
                                "TRANSPORTATION" &&
                                vehicle?.seatCount
                                ? `${vehicle.seatCount} seats`
                                : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-left md:text-right">
                            <p className="text-lg font-bold text-[#1F2933]">
                              {currency}{" "}
                              {formatMoney(calculateItemTotal(item))}
                            </p>
                            <p className="mt-1 text-xs text-[#667085]">
                              {item.serviceType === "AIR_TICKET"
                                ? `Passenger subtotal ${formatMoney(calculateTicketSubtotal(item))}`
                                : `${formatNumber(item.amount)} × ${formatNumber(item.quantity)}${
                                    item.serviceType === "HOTEL_ACCOMMODATION"
                                      ? ` × ${formatNumber(item.numberOfDays)} day${Number(item.numberOfDays) === 1 ? "" : "s"}`
                                      : ""
                                  }`}
                              {Number(item.discount) > 0
                                ? ` · Discount ${formatNumber(item.discount)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              editItem(item)
                            }
                            className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              removeItem(item.id)
                            }
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="mt-6">
  <QuotationBankTermsSelector
    serviceTypes={items.map(
      (item) => item.serviceType
    )}
    value={quotationOptions}
    onChange={setQuotationOptions}
  />
</div>
          </section>
          {/* SUMMARY */}
          <aside className="h-fit rounded-2xl border border-[#E4E7EC] bg-white p-6 shadow-sm lg:sticky lg:top-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
              Summary
            </p>
            <h2 className="mt-2 text-xl font-bold text-[#1F2933]">
              Quotation Total
            </h2>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#667085]">
                  Services
                </span>
                <span className="font-semibold text-[#1F2933]">
                  {items.length}
                </span>
              </div>
              <div className="border-t border-[#E4E7EC] pt-4">
                <div className="flex items-end justify-between gap-4">
                  <span className="text-sm font-semibold text-[#667085]">
                    Grand Total
                  </span>
                  <span className="text-2xl font-black text-[#0F6B5B]">
                    {currency} {formatMoney(grandTotal)}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={generateQuotation}
              disabled={
                saving ||
                !selectedCustomerId ||
                items.length === 0
              }
              className="mt-7 w-full rounded-xl bg-[#0F6B5B] px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#0F6B5B]/15 transition hover:bg-[#0A4F44] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Generating..."
                : "Generate Quotation"}
            </button>
            <p className="mt-3 text-center text-[11px] leading-5 text-[#98A2B3]">
              Customer and service details will be saved with
              the quotation.
            </p>
          </aside>
        </div>
      </div>
      {/* SERVICE MODAL */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#E4E7EC] bg-white px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
                  Quotation
                </p>
                <h2 className="mt-1 text-xl font-bold text-[#1F2933]">
                  {items.some(
                    (item) =>
                      item.id === draftItem.id
                  )
                    ? "Edit Service"
                    : "Add Service"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeServiceModal}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-xl text-[#667085] hover:bg-[#F7F8F6]"
              >
                ×
              </button>
            </div>
            <form
              onSubmit={
                items.some(
                  (item) =>
                    item.id === draftItem.id
                )
                  ? saveEditedService
                  : addService
              }
              className="p-6"
            >
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}
              <label
                htmlFor="serviceType"
                className="block text-sm font-semibold text-[#1F2933]"
              >
                Service Type
              </label>
              <select
                id="serviceType"
                value={draftItem.serviceType}
                onChange={(event) =>
                  changeDraftService(
                    event.target.value as ServiceType
                  )
                }
                className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
              >
                <option value="UMRAH_VISA">
                  Umrah Visa
                </option>
                <option value="RAWDHA">
                  Rawdha
                </option>
                <option value="HOTEL_ACCOMMODATION">
                  Hotel Accommodation
                </option>
                <option value="AIR_TICKET">
                  Air Ticket
                </option>
                <option value="TRANSPORTATION">
                  Transportation
                </option>
              </select>
              {/* VISA */}
              {draftItem.serviceType ===
                "UMRAH_VISA" && (
                <div className="mt-5">
                  <label className="block text-sm font-semibold text-[#1F2933]">
                    Visa Type
                  </label>
                  <select
                    value={draftItem.visaType}
                    onChange={(event) => {
                      updateDraft(
                        "visaType",
                        event.target.value
                      );
                      focusAmount();
                    }}
                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                  >
                    <option value="GROUP">
                      Group
                    </option>
                    <option value="INDIVIDUAL_VISA">
                      Individual Visa
                    </option>
                    <option value="HOST_UMRAH_VISA">
                      Host Umrah Visa
                    </option>
                  </select>
                </div>
              )}
              {/* HOTEL */}
              {draftItem.serviceType ===
                "HOTEL_ACCOMMODATION" && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#1F2933]">
                      Hotel Name
                    </label>
                    <input
                      value={draftItem.hotelName}
                      onChange={(event) =>
                        updateDraft(
                          "hotelName",
                          event.target.value
                        )
                      }
                      placeholder="Enter hotel name"
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2933]">
                      Room Type
                    </label>
                    <select
                      required
                      value={draftItem.roomType}
                      onChange={(event) => updateDraft("roomType", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    >
                      <option value="">Select room type</option>
                      {hotelRoomTypes.map((roomType) => (
                        <option key={roomType.id} value={roomType.name}>
                          {roomType.name}
                        </option>
                      ))}
                    </select>
                    {hotelRoomTypes.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        Add an active room type in Settings → Services first.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2933]">
                      Number of Days
                    </label>
                    <select
                      required
                      value={draftItem.numberOfDays}
                      onChange={(event) => updateDraft("numberOfDays", event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    >
                      <option value="">Select days</option>
                      {hotelStayDurations.map((duration) => (
                        <option key={duration.id} value={duration.days}>
                          {duration.days} {duration.days === 1 ? "day" : "days"}
                        </option>
                      ))}
                    </select>
                    {hotelStayDurations.length === 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        Add an active stay duration in Settings → Services first.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2933]">
                      AC Type
                    </label>
                    <select
                      value={draftItem.acType}
                      onChange={(event) =>
                        updateDraft(
                          "acType",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    >
                      <option value="AC">
                        AC
                      </option>
                      <option value="NON_AC">
                        Non-AC
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2933]">
                      Accommodation
                    </label>
                    <select
                      value={draftItem.boardType}
                      onChange={(event) => {
                        updateDraft(
                          "boardType",
                          event.target.value
                        );
                        focusAmount();
                      }}
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    >
                      <option value="ROOM_ONLY">
                        Room Only
                      </option>
                      <option value="BED_BREAKFAST">
                        Bed &amp; Breakfast
                      </option>
                    </select>
                  </div>
                </div>
              )}
              {/* AIR TICKET DETAILS */}
              {draftItem.serviceType === "AIR_TICKET" && (
                <div className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-[#1F2933]">
                        Airline <span className="text-red-600">*</span>
                      </label>
                      <select
                        required
                        value={draftItem.airlineName}
                        onChange={(event) => updateDraft("airlineName", event.target.value)}
                        className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                      >
                        <option value="">Select Airline</option>
                        {airlines.map((airline) => (
                          <option key={airline.id} value={airline.name}>
                            {airline.name}
                          </option>
                        ))}
                      </select>
                      {airlines.length === 0 && (
                        <p className="mt-2 text-xs text-amber-700">
                          No active airlines are configured. Add an airline in Settings → Services.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[#1F2933]">
                        Baggage Allowance (kg)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="9999.99"
                        step="0.5"
                        value={draftItem.baggageWeightKg}
                        onChange={(event) => updateDraft("baggageWeightKg", event.target.value)}
                        placeholder="e.g. 30"
                        className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2933]">
                      Ticket Type
                    </label>
                    <select
                      value={draftItem.ticketType}
                      onChange={(event) => {
                        updateDraft("ticketType", event.target.value);
                        focusInput(adultPriceRef);
                      }}
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    >
                      <option value="ONE_WAY">One Way</option>
                      <option value="RETURN">Return</option>
                    </select>
                  </div>
                </div>
              )}
              {/* TRANSPORT */}
              {draftItem.serviceType ===
                "TRANSPORTATION" && (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2933]">
                      Route
                    </label>
                    <select
                      value={draftItem.routeId}
                      onChange={(event) =>
                        updateDraft(
                          "routeId",
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    >
                      <option value="">
                        Select Route
                      </option>
                      {routes.map((route) => (
                        <option
                          key={route.id}
                          value={route.id}
                        >
                          {route.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#1F2933]">
                      Vehicle Type
                    </label>
                    <select
                      value={
                        draftItem.vehicleTypeId
                      }
                      onChange={(event) => {
                        updateDraft(
                          "vehicleTypeId",
                          event.target.value
                        );
                        focusAmount();
                      }}
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    >
                      <option value="">
                        Select Vehicle
                      </option>
                      {vehicleTypes.map(
                        (vehicle) => (
                          <option
                            key={vehicle.id}
                            value={vehicle.id}
                          >
                            {vehicle.name}
                            {vehicle.seatCount
                              ? ` (${vehicle.seatCount} seats)`
                              : ""}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>
              )}
              {/* PRICE */}
              {draftItem.serviceType === "AIR_TICKET" ? (
                <div className="mt-6 space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    {[
                      { label: "Adult", priceField: "adultPrice" as const, quantityField: "adultQuantity" as const },
                      { label: "Child", priceField: "childPrice" as const, quantityField: "childQuantity" as const },
                      { label: "Infant", priceField: "infantPrice" as const, quantityField: "infantQuantity" as const },
                    ].map((category) => (
                      <div key={category.label} className="rounded-xl border border-[#E4E7EC] bg-[#FCFCFB] p-3">
                        <h3 className="text-sm font-bold text-[#1F2933]">{category.label}</h3>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-[#667085]">Price ({currency})</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              ref={
                                category.priceField === "adultPrice"
                                  ? adultPriceRef
                                  : category.priceField === "childPrice"
                                    ? childPriceRef
                                    : infantPriceRef
                              }
                              value={draftItem[category.priceField]}
                              onChange={(event) => updateDraft(category.priceField, event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  focusInput(
                                    category.priceField === "adultPrice"
                                      ? adultQuantityRef
                                      : category.priceField === "childPrice"
                                        ? childQuantityRef
                                        : infantQuantityRef
                                  );
                                }
                              }}
                              placeholder="0.00"
                              className="mt-1 w-full min-w-0 rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#667085]">Quantity</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              ref={
                                category.quantityField === "adultQuantity"
                                  ? adultQuantityRef
                                  : category.quantityField === "childQuantity"
                                    ? childQuantityRef
                                    : infantQuantityRef
                              }
                              value={draftItem[category.quantityField]}
                              onChange={(event) => updateDraft(category.quantityField, event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  focusInput(
                                    category.quantityField === "adultQuantity"
                                      ? childPriceRef
                                      : category.quantityField === "childQuantity"
                                        ? infantPriceRef
                                        : discountRef
                                  );
                                }
                              }}
                              className="mt-1 w-full min-w-0 rounded-xl border border-[#D0D5DD] px-3 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                            />
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-[#667085]">
                          Subtotal: {currency} {formatMoney((Number(draftItem[category.priceField]) || 0) * (Number(draftItem[category.quantityField]) || 0))}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-semibold text-[#1F2933]">Discount ({currency})</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        ref={discountRef}
                        value={draftItem.discount}
                        onChange={(event) => updateDraft("discount", event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.form?.requestSubmit();
                          }
                        }}
                        className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                      />
                    </div>
                    <div className="flex items-end">
                      <p className="text-xs leading-5 text-[#667085]">
                        Ticket total = adult price × quantity + child price × quantity + infant price × quantity − discount.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="flex min-h-[40px] items-end text-sm font-semibold text-[#1F2933]">
                      {draftItem.serviceType === "HOTEL_ACCOMMODATION"
                        ? `Amount per Room / Day (${currency})`
                        : `Amount (${currency})`}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      ref={amountRef}
                      value={draftItem.amount}
                      onChange={(event) => updateDraft("amount", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          quantityRef.current?.focus();
                          quantityRef.current?.select();
                        }
                      }}
                      placeholder="0.00"
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    />
                  </div>
                  <div>
                    <label className="flex min-h-[40px] items-end text-sm font-semibold text-[#1F2933]">
                      {draftItem.serviceType === "HOTEL_ACCOMMODATION"
                        ? "Number of Rooms"
                        : "Quantity"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      ref={quantityRef}
                      value={draftItem.quantity}
                      onChange={(event) => updateDraft("quantity", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          discountRef.current?.focus();
                          discountRef.current?.select();
                        }
                      }}
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    />
                  </div>
                  <div>
                    <label className="flex min-h-[40px] items-end text-sm font-semibold text-[#1F2933]">Discount ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      ref={discountRef}
                      value={draftItem.discount}
                      onChange={(event) => updateDraft("discount", event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }
                      }}
                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"
                    />
                  </div>
                </div>
              )}
              {draftItem.serviceType === "HOTEL_ACCOMMODATION" && (
                <p className="mt-3 text-xs text-[#667085]">
                  Hotel total = amount per room per day × number of rooms × days − discount.
                </p>
              )}
              <div className="mt-5 rounded-xl bg-[#F7F8F6] p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#667085]">
                    Service Total
                  </span>
                  <span className="text-xl font-black text-[#0F6B5B]">
                    {currency}{" "}
                    {formatMoney(calculateItemTotal(draftItem))}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3 border-t border-[#E4E7EC] pt-5">
                <button
                  type="button"
                  onClick={closeServiceModal}
                  disabled={saving}
                  className="rounded-xl border border-[#D0D5DD] px-5 py-3 text-sm font-bold text-[#344054]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white hover:bg-[#0A4F44] disabled:opacity-50"
                >
                  {items.some(
                    (item) =>
                      item.id === draftItem.id
                  )
                    ? "Update Service"
                    : "Add Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}