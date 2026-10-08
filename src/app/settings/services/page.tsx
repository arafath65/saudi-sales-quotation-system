"use client";

import {
  FormEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";

type Route = {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type VehicleType = {
  id: number;
  name: string;
  seatCount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type RouteForm = {
  name: string;
};

type VehicleForm = {
  name: string;
  seatCount: string;
};

const EMPTY_ROUTE_FORM: RouteForm = {
  name: "",
};

const EMPTY_VEHICLE_FORM: VehicleForm = {
  name: "",
  seatCount: "",
};

export default function ServiceSettingsPage() {
  const pageRef = useRef<HTMLDivElement>(null);

  const routeNameRef = useRef<HTMLInputElement>(null);
  const vehicleNameRef = useRef<HTMLInputElement>(null);

  const routeFormRef = useRef<HTMLFormElement>(null);
  const vehicleFormRef = useRef<HTMLFormElement>(null);

  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<
    VehicleType[]
  >([]);

  const [routeSearch, setRouteSearch] = useState("");
  const [vehicleSearch, setVehicleSearch] = useState("");

  const [routeStatus, setRouteStatus] =
    useState<StatusFilter>("ALL");

  const [vehicleStatus, setVehicleStatus] =
    useState<StatusFilter>("ALL");

  const [routePage, setRoutePage] = useState(1);
  const [vehiclePage, setVehiclePage] = useState(1);

  const [loading, setLoading] = useState(true);

  const [routeModal, setRouteModal] = useState(false);
  const [vehicleModal, setVehicleModal] = useState(false);

  const [editingRoute, setEditingRoute] =
    useState<Route | null>(null);

  const [editingVehicle, setEditingVehicle] =
    useState<VehicleType | null>(null);

  const [routeForm, setRouteForm] =
    useState<RouteForm>(EMPTY_ROUTE_FORM);

  const [vehicleForm, setVehicleForm] =
    useState<VehicleForm>(EMPTY_VEHICLE_FORM);

  const [saving, setSaving] = useState(false);
  const [updatingRouteId, setUpdatingRouteId] =
    useState<number | null>(null);

  const [updatingVehicleId, setUpdatingVehicleId] =
    useState<number | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const PAGE_SIZE = 8;

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    setRoutePage(1);
  }, [routeSearch, routeStatus]);

  useEffect(() => {
    setVehiclePage(1);
  }, [vehicleSearch, vehicleStatus]);

  useLayoutEffect(() => {
    if (!pageRef.current || loading) {
      return;
    }

    const context = gsap.context(() => {
      gsap.from(".service-header", {
        opacity: 0,
        y: 14,
        duration: 0.45,
        ease: "power3.out",
      });

      gsap.from(".service-card", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        stagger: 0.1,
        delay: 0.08,
        ease: "power3.out",
      });
    }, pageRef);

    return () => {
      context.revert();
    };
  }, [loading]);

  useEffect(() => {
    if (routeModal) {
      window.setTimeout(() => {
        routeNameRef.current?.focus();
      }, 80);
    }
  }, [routeModal]);

  useEffect(() => {
    if (vehicleModal) {
      window.setTimeout(() => {
        vehicleNameRef.current?.focus();
      }, 80);
    }
  }, [vehicleModal]);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");

      const [routesResponse, vehiclesResponse] =
        await Promise.all([
          fetch("/api/routes", {
            cache: "no-store",
          }),
          fetch("/api/vehicle-types", {
            cache: "no-store",
          }),
        ]);

      const routesData = await routesResponse.json();
      const vehiclesData = await vehiclesResponse.json();

      if (!routesResponse.ok || !routesData.success) {
        throw new Error(
          routesData.message ?? "Unable to load routes."
        );
      }

      if (!vehiclesResponse.ok || !vehiclesData.success) {
        throw new Error(
          vehiclesData.message ??
            "Unable to load vehicle types."
        );
      }

      setRoutes(routesData.routes);
      setVehicleTypes(vehiclesData.vehicleTypes);
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load service settings."
      );
    } finally {
      setLoading(false);
    }
  }

  function openAddRoute() {
    setEditingRoute(null);
    setRouteForm(EMPTY_ROUTE_FORM);
    setError("");
    setMessage("");
    setRouteModal(true);
  }

  function openEditRoute(route: Route) {
    setEditingRoute(route);

    setRouteForm({
      name: route.name,
    });

    setError("");
    setMessage("");
    setRouteModal(true);
  }

  function openAddVehicle() {
    setEditingVehicle(null);
    setVehicleForm(EMPTY_VEHICLE_FORM);
    setError("");
    setMessage("");
    setVehicleModal(true);
  }

  function openEditVehicle(vehicle: VehicleType) {
    setEditingVehicle(vehicle);

    setVehicleForm({
      name: vehicle.name,
      seatCount:
        vehicle.seatCount === null
          ? ""
          : String(vehicle.seatCount),
    });

    setError("");
    setMessage("");
    setVehicleModal(true);
  }

  function closeModals() {
    if (saving) {
      return;
    }

    setRouteModal(false);
    setVehicleModal(false);
    setError("");
  }

  function handleRouteEnter(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      routeFormRef.current?.requestSubmit();
    }
  }

  function handleVehicleEnter(
    event: React.KeyboardEvent<HTMLInputElement>
  ) {
    if (event.key === "Enter") {
      event.preventDefault();

      if (event.currentTarget === vehicleNameRef.current) {
        const seatInput =
          vehicleFormRef.current?.querySelector<HTMLInputElement>(
            "#seatCount"
          );

        seatInput?.focus();
        return;
      }

      vehicleFormRef.current?.requestSubmit();
    }
  }

  async function saveRoute(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name = routeForm.name.trim();

    if (!name) {
      setError("Route name is required.");
      routeNameRef.current?.focus();
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const editing = Boolean(editingRoute);

      const response = await fetch(
        editing
          ? `/api/routes/${editingRoute!.id}`
          : "/api/routes",
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Unable to save route."
        );
      }

      setRouteModal(false);
      setRouteForm(EMPTY_ROUTE_FORM);

      setMessage(
        editing
          ? "Route updated successfully."
          : "Route created successfully."
      );

      await loadAll();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save route."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveVehicle(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const name = vehicleForm.name.trim();

    if (!name) {
      setError("Vehicle type name is required.");
      vehicleNameRef.current?.focus();
      return;
    }

    let seatCount: number | null = null;

    if (vehicleForm.seatCount.trim()) {
      seatCount = Number(vehicleForm.seatCount);

      if (!Number.isInteger(seatCount) || seatCount <= 0) {
        setError(
          "Seat count must be a positive whole number."
        );
        return;
      }
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      const editing = Boolean(editingVehicle);

      const response = await fetch(
        editing
          ? `/api/vehicle-types/${editingVehicle!.id}`
          : "/api/vehicle-types",
        {
          method: editing ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            seatCount,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Unable to save vehicle type."
        );
      }

      setVehicleModal(false);
      setVehicleForm(EMPTY_VEHICLE_FORM);

      setMessage(
        editing
          ? "Vehicle type updated successfully."
          : "Vehicle type created successfully."
      );

      await loadAll();
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to save vehicle type."
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleRoute(route: Route) {
    try {
      setUpdatingRouteId(route.id);
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/routes/${route.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: route.name,
            isActive: !route.isActive,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ?? "Unable to update route."
        );
      }

      setRoutes((current) =>
        current.map((item) =>
          item.id === route.id ? data.route : item
        )
      );

      setMessage(
        `Route ${
          route.isActive ? "deactivated" : "activated"
        } successfully.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update route."
      );
    } finally {
      setUpdatingRouteId(null);
    }
  }

  async function toggleVehicle(vehicle: VehicleType) {
    try {
      setUpdatingVehicleId(vehicle.id);
      setError("");
      setMessage("");

      const response = await fetch(
        `/api/vehicle-types/${vehicle.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: vehicle.name,
            seatCount: vehicle.seatCount,
            isActive: !vehicle.isActive,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ??
            "Unable to update vehicle type."
        );
      }

      setVehicleTypes((current) =>
        current.map((item) =>
          item.id === vehicle.id
            ? data.vehicleType
            : item
        )
      );

      setMessage(
        `Vehicle type ${
          vehicle.isActive ? "deactivated" : "activated"
        } successfully.`
      );
    } catch (err) {
      console.error(err);

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update vehicle type."
      );
    } finally {
      setUpdatingVehicleId(null);
    }
  }

  const filteredRoutes = useMemo(() => {
    const query = routeSearch.trim().toLowerCase();

    return routes.filter((route) => {
      const statusMatch =
        routeStatus === "ALL" ||
        (routeStatus === "ACTIVE" && route.isActive) ||
        (routeStatus === "INACTIVE" && !route.isActive);

      if (!statusMatch) {
        return false;
      }

      return (
        !query ||
        route.name.toLowerCase().includes(query)
      );
    });
  }, [routes, routeSearch, routeStatus]);

  const filteredVehicles = useMemo(() => {
    const query = vehicleSearch.trim().toLowerCase();

    return vehicleTypes.filter((vehicle) => {
      const statusMatch =
        vehicleStatus === "ALL" ||
        (vehicleStatus === "ACTIVE" &&
          vehicle.isActive) ||
        (vehicleStatus === "INACTIVE" &&
          !vehicle.isActive);

      if (!statusMatch) {
        return false;
      }

      return (
        !query ||
        vehicle.name.toLowerCase().includes(query)
      );
    });
  }, [vehicleTypes, vehicleSearch, vehicleStatus]);

  const routeTotalPages = Math.max(
    1,
    Math.ceil(filteredRoutes.length / PAGE_SIZE)
  );

  const vehicleTotalPages = Math.max(
    1,
    Math.ceil(filteredVehicles.length / PAGE_SIZE)
  );

  useEffect(() => {
    if (routePage > routeTotalPages) {
      setRoutePage(routeTotalPages);
    }
  }, [routePage, routeTotalPages]);

  useEffect(() => {
    if (vehiclePage > vehicleTotalPages) {
      setVehiclePage(vehicleTotalPages);
    }
  }, [vehiclePage, vehicleTotalPages]);

  const displayedRoutes = useMemo(() => {
    const start = (routePage - 1) * PAGE_SIZE;

    return filteredRoutes.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredRoutes, routePage]);

  const displayedVehicles = useMemo(() => {
    const start = (vehiclePage - 1) * PAGE_SIZE;

    return filteredVehicles.slice(
      start,
      start + PAGE_SIZE
    );
  }, [filteredVehicles, vehiclePage]);

  function pagination(
    current: number,
    total: number,
    setPage: (page: number) => void
  ) {
    const pages: number[] = [];

    if (total <= 5) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (current > 3) {
        pages.push(-1);
      }

      for (
        let i = Math.max(2, current - 1);
        i <= Math.min(total - 1, current + 1);
        i++
      ) {
        pages.push(i);
      }

      if (current < total - 2) {
        pages.push(-2);
      }

      pages.push(total);
    }

    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPage(current - 1)}
          disabled={current === 1}
          className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Previous
        </button>

        {pages.map((page, index) =>
          page < 0 ? (
            <span
              key={`${page}-${index}`}
              className="px-2 text-[#98A2B3]"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => setPage(page)}
              className={`min-w-9 rounded-lg px-3 py-2 text-xs font-bold ${
                current === page
                  ? "bg-[#0F6B5B] text-white"
                  : "border border-[#D0D5DD] bg-white text-[#344054]"
              }`}
            >
              {page}
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => setPage(current + 1)}
          disabled={current === total}
          className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Next
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F7F8F6] p-6">
        <div className="mx-auto max-w-7xl">
          <div className="h-8 w-72 animate-pulse rounded bg-[#E4E7EC]" />
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="h-96 animate-pulse rounded-2xl bg-white" />
            <div className="h-96 animate-pulse rounded-2xl bg-white" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      ref={pageRef}
      className="min-h-screen bg-[#F7F8F6] p-4 sm:p-6 lg:p-8"
    >
      <div className="mx-auto max-w-7xl">
        <header className="service-header">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
            Settings
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#1F2933]">
            Service Settings
          </h1>

          <p className="mt-2 text-sm text-[#667085]">
            Manage transportation routes and vehicle types used
            in quotations.
          </p>
        </header>

        {message && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {message}
          </div>
        )}

        {error && !routeModal && !vehicleModal && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* ROUTES */}
          <section className="service-card overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
            <div className="border-b border-[#E4E7EC] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2933]">
                    Transportation Routes
                  </h2>

                  <p className="mt-1 text-xs text-[#667085]">
                    Add routes available for transport quotations.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openAddRoute}
                  className="rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0A4F44]"
                >
                  + Add Route
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={routeSearch}
                  onChange={(event) =>
                    setRouteSearch(event.target.value)
                  }
                  placeholder="Search routes..."
                  className="min-w-0 flex-1 rounded-xl border border-[#D0D5DD] px-4 py-2.5 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                />

                <select
                  value={routeStatus}
                  onChange={(event) =>
                    setRouteStatus(
                      event.target.value as StatusFilter
                    )
                  }
                  className="w-32 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#0F6B5B]"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-[#F0F2F4]">
              {displayedRoutes.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <p className="text-sm font-semibold text-[#1F2933]">
                    No routes found
                  </p>

                  <p className="mt-1 text-xs text-[#98A2B3]">
                    Add a route to use it in transportation
                    quotations.
                  </p>
                </div>
              ) : (
                displayedRoutes.map((route) => (
                  <div
                    key={route.id}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#FAFAF8]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1F2933]">
                        {route.name}
                      </p>

                      <span
                        className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${
                          route.isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {route.isActive
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditRoute(route)
                        }
                        className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054]"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleRoute(route)
                        }
                        disabled={
                          updatingRouteId === route.id
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${
                          route.isActive
                            ? "border border-red-200 text-red-600"
                            : "bg-[#0F6B5B] text-white"
                        } disabled:opacity-50`}
                      >
                        {updatingRouteId === route.id
                          ? "..."
                          : route.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {filteredRoutes.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#667085]">
                  Showing{" "}
                  {Math.min(
                    (routePage - 1) * PAGE_SIZE + 1,
                    filteredRoutes.length
                  )}{" "}
                  –{" "}
                  {Math.min(
                    routePage * PAGE_SIZE,
                    filteredRoutes.length
                  )}{" "}
                  of {filteredRoutes.length}
                </p>

                {pagination(
                  routePage,
                  routeTotalPages,
                  setRoutePage
                )}
              </div>
            )}
          </section>

          {/* VEHICLES */}
          <section className="service-card overflow-hidden rounded-2xl border border-[#E4E7EC] bg-white shadow-sm">
            <div className="border-b border-[#E4E7EC] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-[#1F2933]">
                    Vehicle Types
                  </h2>

                  <p className="mt-1 text-xs text-[#667085]">
                    Add vehicle types and optional seat capacity.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openAddVehicle}
                  className="rounded-xl bg-[#0F6B5B] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#0A4F44]"
                >
                  + Add Vehicle
                </button>
              </div>

              <div className="mt-4 flex gap-2">
                <input
                  value={vehicleSearch}
                  onChange={(event) =>
                    setVehicleSearch(event.target.value)
                  }
                  placeholder="Search vehicle types..."
                  className="min-w-0 flex-1 rounded-xl border border-[#D0D5DD] px-4 py-2.5 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
                />

                <select
                  value={vehicleStatus}
                  onChange={(event) =>
                    setVehicleStatus(
                      event.target.value as StatusFilter
                    )
                  }
                  className="w-32 rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-xs outline-none focus:border-[#0F6B5B]"
                >
                  <option value="ALL">All</option>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div className="divide-y divide-[#F0F2F4]">
              {displayedVehicles.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <p className="text-sm font-semibold text-[#1F2933]">
                    No vehicle types found
                  </p>

                  <p className="mt-1 text-xs text-[#98A2B3]">
                    Add a vehicle type to use it in transportation
                    quotations.
                  </p>
                </div>
              ) : (
                displayedVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-[#FAFAF8]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1F2933]">
                        {vehicle.name}
                      </p>

                      <div className="mt-1 flex items-center gap-2">
                        {vehicle.seatCount ? (
                          <span className="text-xs text-[#667085]">
                            {vehicle.seatCount} seats
                          </span>
                        ) : (
                          <span className="text-xs text-[#98A2B3]">
                            Seat count not set
                          </span>
                        )}

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            vehicle.isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {vehicle.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openEditVehicle(vehicle)
                        }
                        className="rounded-lg border border-[#D0D5DD] px-3 py-2 text-xs font-bold text-[#344054]"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          toggleVehicle(vehicle)
                        }
                        disabled={
                          updatingVehicleId === vehicle.id
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-bold ${
                          vehicle.isActive
                            ? "border border-red-200 text-red-600"
                            : "bg-[#0F6B5B] text-white"
                        } disabled:opacity-50`}
                      >
                        {updatingVehicleId === vehicle.id
                          ? "..."
                          : vehicle.isActive
                            ? "Deactivate"
                            : "Activate"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {filteredVehicles.length > 0 && (
              <div className="flex flex-col gap-3 border-t border-[#E4E7EC] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-[#667085]">
                  Showing{" "}
                  {Math.min(
                    (vehiclePage - 1) * PAGE_SIZE + 1,
                    filteredVehicles.length
                  )}{" "}
                  –{" "}
                  {Math.min(
                    vehiclePage * PAGE_SIZE,
                    filteredVehicles.length
                  )}{" "}
                  of {filteredVehicles.length}
                </p>

                {pagination(
                  vehiclePage,
                  vehicleTotalPages,
                  setVehiclePage
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* ROUTE MODAL */}
      {routeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
                  Transportation
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#1F2933]">
                  {editingRoute
                    ? "Edit Route"
                    : "Add Route"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModals}
                disabled={saving}
                className="text-2xl text-[#667085]"
              >
                ×
              </button>
            </div>

            <form
              ref={routeFormRef}
              onSubmit={saveRoute}
              className="p-6"
            >
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <label
                htmlFor="routeName"
                className="text-sm font-semibold text-[#1F2933]"
              >
                Route Name *
              </label>

              <input
                ref={routeNameRef}
                id="routeName"
                value={routeForm.name}
                onChange={(event) =>
                  setRouteForm({
                    name: event.target.value,
                  })
                }
                onKeyDown={handleRouteEnter}
                placeholder="e.g. Jeddah → Makkah"
                className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
              />

              <div className="mt-6 flex justify-end gap-3 border-t border-[#E4E7EC] pt-5">
                <button
                  type="button"
                  onClick={closeModals}
                  disabled={saving}
                  className="rounded-xl border border-[#D0D5DD] px-5 py-3 text-sm font-bold text-[#344054]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingRoute
                      ? "Update Route"
                      : "Save Route"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VEHICLE MODAL */}
      {vehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101828]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E4E7EC] px-6 py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#C9A227]">
                  Transportation
                </p>

                <h2 className="mt-1 text-xl font-bold text-[#1F2933]">
                  {editingVehicle
                    ? "Edit Vehicle Type"
                    : "Add Vehicle Type"}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeModals}
                disabled={saving}
                className="text-2xl text-[#667085]"
              >
                ×
              </button>
            </div>

            <form
              ref={vehicleFormRef}
              onSubmit={saveVehicle}
              className="p-6"
            >
              {error && (
                <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <label
                htmlFor="vehicleName"
                className="text-sm font-semibold text-[#1F2933]"
              >
                Vehicle Type *
              </label>

              <input
                ref={vehicleNameRef}
                id="vehicleName"
                value={vehicleForm.name}
                onChange={(event) =>
                  setVehicleForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                onKeyDown={handleVehicleEnter}
                placeholder="e.g. Van"
                className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
              />

              <label
                htmlFor="seatCount"
                className="mt-5 block text-sm font-semibold text-[#1F2933]"
              >
                Seat Count
              </label>

              <input
                id="seatCount"
                type="number"
                min="1"
                value={vehicleForm.seatCount}
                onChange={(event) =>
                  setVehicleForm((current) => ({
                    ...current,
                    seatCount: event.target.value,
                  }))
                }
                onKeyDown={handleVehicleEnter}
                placeholder="e.g. 12"
                className="mt-2 w-full rounded-xl border border-[#D0D5DD] px-4 py-3 text-sm outline-none focus:border-[#0F6B5B] focus:ring-4 focus:ring-[#0F6B5B]/10"
              />

              <p className="mt-2 text-xs text-[#98A2B3]">
                Seat count is optional.
              </p>

              <div className="mt-6 flex justify-end gap-3 border-t border-[#E4E7EC] pt-5">
                <button
                  type="button"
                  onClick={closeModals}
                  disabled={saving}
                  className="rounded-xl border border-[#D0D5DD] px-5 py-3 text-sm font-bold text-[#344054]"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[#0F6B5B] px-6 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingVehicle
                      ? "Update Vehicle"
                      : "Save Vehicle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}