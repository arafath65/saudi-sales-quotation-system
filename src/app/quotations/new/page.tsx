"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";



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



type ServiceType =

  | "UMRAH_VISA"

  | "HOTEL_ACCOMMODATION"

  | "AIR_TICKET"

  | "TRANSPORTATION";



type QuotationItem = {

  id: string;

  serviceType: ServiceType;



  visaType: string;



  hotelName: string;

  paxCount: string;

  acType: string;

  boardType: string;



  ticketType: string;



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

    paxCount: "1",

    acType: "AC",

    boardType: "ROOM_ONLY",



    ticketType: "ONE_WAY",



    routeId: "",

    vehicleTypeId: "",



    amount: "",

    quantity: "1",

    discount: "0",

  };

}



function calculateItemTotal(item: QuotationItem) {

  const amount = Number(item.amount) || 0;

  const quantity = Number(item.quantity) || 0;

  const discount = Number(item.discount) || 0;



  return Math.max(

    0,

    amount * quantity - discount

  );

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



export default function NewQuotationPage() {

  const router = useRouter();



  const [customers, setCustomers] =

    useState<Customer[]>([]);



  const [routes, setRoutes] = useState<Route[]>([]);

  const [vehicleTypes, setVehicleTypes] =

    useState<VehicleType[]>([]);



  const [selectedCustomerId, setSelectedCustomerId] =

    useState("");



  const [customerSearch, setCustomerSearch] =

    useState("");



  const [showCustomerResults, setShowCustomerResults] =

    useState(false);



  const [items, setItems] = useState<

    QuotationItem[]

  >([]);



  const [itemModalOpen, setItemModalOpen] =

    useState(false);



  const [draftItem, setDraftItem] =

    useState<QuotationItem>(newItem("UMRAH_VISA"));



  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);



  const [error, setError] = useState("");

  const amountRef = useRef<HTMLInputElement>(null);
  const quantityRef = useRef<HTMLInputElement>(null);
  const discountRef = useRef<HTMLInputElement>(null);

  function focusAmount() {
    window.requestAnimationFrame(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    });
  }

  const loadQuotationData = useCallback(async () => {

    try {

      setLoading(true);

      setError("");



      const [

        customersResponse,

        routesResponse,

        vehiclesResponse,

      ] = await Promise.all([

        fetch("/api/customers", {

          cache: "no-store",

        }),



        fetch("/api/routes", {

          cache: "no-store",

        }),



        fetch("/api/vehicle-types", {

          cache: "no-store",

        }),

      ]);



      const customersData =

        await customersResponse.json();



      const routesData =

        await routesResponse.json();



      const vehiclesData =

        await vehiclesResponse.json();



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



      if (

        !vehiclesResponse.ok ||

        !vehiclesData.success

      ) {

        throw new Error(

          vehiclesData.message ??

            "Unable to load vehicle types."

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

          (vehicle: VehicleType) =>

            vehicle.isActive

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

  }, []);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void loadQuotationData();
  }, 0);

  return () => window.clearTimeout(timer);
}, [loadQuotationData]);



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

    const query = customerSearch

      .trim()

      .toLowerCase();



    if (!query) {

      return customers.slice(0, 8);

    }



    return customers

      .filter((customer) =>

        [

          customer.customerCode,

          customer.name,

          customer.mobile,

          customer.whatsapp,

          customer.iqamaNo,

          customer.passportNo,

        ]

          .filter(Boolean)

          .some((value) =>

            String(value)

              .toLowerCase()

              .includes(query)

          )

      )

      .slice(0, 8);

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



  function changeDraftService(

    serviceType: ServiceType

  ) {

    setDraftItem({

      ...newItem(serviceType),

      id: draftItem.id,

    });

  }



  function addService(event: FormEvent) {

    event.preventDefault();



    if (

      !draftItem.amount ||

      Number(draftItem.amount) <= 0

    ) {

      setError("Please enter a valid amount.");

      return;

    }



    if (

      !draftItem.quantity ||

      Number(draftItem.quantity) <= 0

    ) {

      setError("Please enter a valid quantity.");

      return;

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

      Number(draftItem.discount) >

      Number(draftItem.amount) *

        Number(draftItem.quantity)

    ) {

      setError(

        "Discount cannot exceed the service amount."

      );

      return;

    }



    if (

      draftItem.serviceType ===

      "HOTEL_ACCOMMODATION" &&

      !draftItem.hotelName.trim()

    ) {

      setError("Please enter the hotel name.");

      return;

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



    if (

      draftItem.serviceType ===

        "HOTEL_ACCOMMODATION" &&

      Number(draftItem.paxCount) <= 0

    ) {

      setError("Please select the pax count.");

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



  function saveEditedService(

    event: FormEvent

  ) {

    event.preventDefault();



    if (

      Number(draftItem.amount) <= 0 ||

      Number(draftItem.quantity) <= 0

    ) {

      setError(

        "Amount and quantity must be greater than zero."

      );

      return;

    }



    if (

      Number(draftItem.discount) >

      Number(draftItem.amount) *

        Number(draftItem.quantity)

    ) {

      setError(

        "Discount cannot exceed the service amount."

      );

      return;

    }



    if (

      draftItem.serviceType ===

        "HOTEL_ACCOMMODATION" &&

      !draftItem.hotelName.trim()

    ) {

      setError("Please enter the hotel name.");

      return;

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



          paxCount:

            item.serviceType === "HOTEL_ACCOMMODATION"

              ? Number(item.paxCount)

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



          routeId:

            item.serviceType === "TRANSPORTATION"

              ? Number(item.routeId)

              : undefined,



          vehicleTypeId:

            item.serviceType === "TRANSPORTATION"

              ? Number(item.vehicleTypeId)

              : undefined,



          amount: Number(item.amount),

          quantity: Number(item.quantity),

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



              <div className="relative mt-5">

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

                  placeholder="Search by customer name, Iqama, contact or code..."

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

                                <span>Iqama: {customer.iqamaNo?.trim() || "—"}</span>

                                <span className="mx-2 text-[#D0D5DD]">·</span>

                                <span>Contact: {customer.mobile || "—"}</span>

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

                        <span>Iqama: {selectedCustomer.iqamaNo?.trim() || "—"}</span>

                        <span className="mx-2 text-[#D0D5DD]">·</span>

                        <span>Contact: {selectedCustomer.mobile || "—"}</span>

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

                      Add Umrah Visa, Hotel, Air Ticket or

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



                              {item.serviceType ===

                                "AIR_TICKET" &&

                                `${

                                  item.ticketType ===

                                  "RETURN"

                                    ? "Return"

                                    : "One Way"

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

                                `${item.paxCount} Pax · ${

                                  item.acType ===

                                  "AC"

                                    ? "AC"

                                    : "Non-AC"

                                } · ${

                                  item.boardType ===

                                  "BED_BREAKFAST"

                                    ? "Bed & Breakfast"

                                    : "Room Only"

                                }`}



                              {item.serviceType ===

                                "TRANSPORTATION" &&

                                vehicle?.seatCount

                                ? `${vehicle.seatCount} seats`

                                : ""}

                            </p>

                          </div>



                          <div className="shrink-0 text-left md:text-right">

                            <p className="text-lg font-bold text-[#1F2933]">

                              SAR{" "}

                              {formatMoney(calculateItemTotal(item))}

                            </p>



                            <p className="mt-1 text-xs text-[#667085]">

                              {formatNumber(item.amount)} ×{" "}

                              {formatNumber(item.quantity)}

                              {Number(item.discount) >

                                0

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

                    SAR {formatMoney(grandTotal)}

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

                      Pax Count

                    </label>



                    <select

                      value={draftItem.paxCount}

                      onChange={(event) =>

                        updateDraft(

                          "paxCount",

                          event.target.value

                        )

                      }

                      className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"

                    >

                      {Array.from(

                        { length: 20 },

                        (_, index) => (

                          <option

                            key={index + 1}

                            value={index + 1}

                          >

                            {index + 1} Pax

                          </option>

                        )

                      )}

                    </select>

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



                  <div className="sm:col-span-2">

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



              {/* TICKET */}

              {draftItem.serviceType ===

                "AIR_TICKET" && (

                <div className="mt-5">

                  <label className="block text-sm font-semibold text-[#1F2933]">

                    Ticket Type

                  </label>



                  <select

                    value={draftItem.ticketType}

                    onChange={(event) => {


                      updateDraft(


                        "ticketType",


                        event.target.value


                      );


                      focusAmount();


                    }}

                    className="mt-2 w-full rounded-xl border border-[#D0D5DD] bg-white px-4 py-3 text-sm outline-none focus:border-[#0F6B5B]"

                  >

                    <option value="ONE_WAY">

                      One Way

                    </option>



                    <option value="RETURN">

                      Return

                    </option>

                  </select>

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

              <div className="mt-6 grid gap-4 sm:grid-cols-3">

                <div>

                  <label className="block text-sm font-semibold text-[#1F2933]">

                    Amount (SAR)

                  </label>



                  <input

                    type="number"

                    min="0"

                    step="0.01"

                    ref={amountRef}


                    value={draftItem.amount}


                    onChange={(event) =>


                      updateDraft(


                        "amount",


                        event.target.value


                      )


                    }


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

                  <label className="block text-sm font-semibold text-[#1F2933]">

                    Quantity

                  </label>



                  <input

                    type="number"

                    min="1"

                    step="1"

                    ref={quantityRef}


                    value={draftItem.quantity}


                    onChange={(event) =>


                      updateDraft(


                        "quantity",


                        event.target.value


                      )


                    }


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

                  <label className="block text-sm font-semibold text-[#1F2933]">

                    Discount (SAR)

                  </label>



                  <input

                    type="number"

                    min="0"

                    step="0.01"

                    ref={discountRef}


                    value={draftItem.discount}


                    onChange={(event) =>


                      updateDraft(


                        "discount",


                        event.target.value


                      )


                    }


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



              <div className="mt-5 rounded-xl bg-[#F7F8F6] p-4">

                <div className="flex items-center justify-between">

                  <span className="text-sm font-semibold text-[#667085]">

                    Service Total

                  </span>



                  <span className="text-xl font-black text-[#0F6B5B]">

                    SAR{" "}

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
