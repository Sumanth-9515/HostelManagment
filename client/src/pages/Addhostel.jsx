import { useState, useEffect } from "react";
import { API, authHeaders } from "../api.js";
import { useToast, Toast, Modal, Badge, Btn, inputStyle } from "../components/ui.jsx";

const SHARE_OPTIONS = [1, 2, 3, 4, 5, 6];

// ─── Styled Form Modal ────────────────────────────────────────────────────────
function FormModal({ open, onClose, title, subtitle, icon, children }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: "rgba(15,23,42,0.45)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-modalPop"
        style={{ background: "#fff" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Gradient Header */}
        <div
          className="px-6 pt-6 pb-5"
          style={{
            background: "linear-gradient(135deg, #1e40af 0%, #7c3aed 100%)",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
                {icon}
              </div>
              <div>
                <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
                {subtitle && <p className="text-blue-200 text-xs mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Styled Input ─────────────────────────────────────────────────────────────
function FormField({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
        {label} {required && <span className="text-blue-500">*</span>}
      </label>
      {children}
    </div>
  );
}

const fieldStyle =
  "w-full px-4 py-3 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-900 text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white transition-all";

// ─── Action Buttons ───────────────────────────────────────────────────────────
function FormActions({ onCancel, onSubmit, submitLabel }) {
  return (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onCancel}
        className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-all"
      >
        Cancel
      </button>
      <button
        onClick={onSubmit}
        className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)" }}
      >
        {submitLabel}
      </button>
    </div>
  );
}

// ─── Tenant Detail Modal ──────────────────────────────────────────────────────
function BedTenantModal({ tenant, onClose }) {
  if (!tenant) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
          <h2 className="text-gray-900 font-bold text-lg">Tenant Details</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 flex items-center justify-center text-white text-2xl font-bold">
              {tenant.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{tenant.name}</h3>
              <p className="text-gray-500 text-sm">{tenant.phone}</p>
              {tenant.email && <p className="text-gray-400 text-xs">{tenant.email}</p>}
            </div>
          </div>
          {tenant.fatherName && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Father's Name</p>
              <p className="text-gray-900 font-medium">{tenant.fatherName}</p>
              {tenant.fatherPhone && <p className="text-gray-600 text-sm mt-1">{tenant.fatherPhone}</p>}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Joining Date</p>
              <p className="text-gray-900 font-medium">{new Date(tenant.joiningDate).toLocaleDateString()}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Monthly Rent</p>
              <p className="text-gray-900 font-medium">₹{tenant.rentAmount}</p>
            </div>
          </div>
          {tenant.permanentAddress && (
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Address</p>
              <p className="text-gray-900 text-sm">{tenant.permanentAddress}</p>
            </div>
          )}
          {tenant.allocationInfo && (
            <div className="rounded-xl bg-amber-50 p-3">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-1">Allocation</p>
              <p className="text-gray-900 text-sm">
                {tenant.allocationInfo.buildingName} - Floor {tenant.allocationInfo.floorNumber} - Room {tenant.allocationInfo.roomNumber} - Bed {tenant.allocationInfo.bedNumber}
              </p>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <a href={`tel:${tenant.phone}`} className="flex-1 text-center px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors">📞 Call</a>
            <button className="flex-1 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors">💬 WhatsApp</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Floor Selection Modal ────────────────────────────────────────────────────
function FloorModal({ building, floors, onSelectFloor, onAddFloor, onEditFloor, onDeleteFloor, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div>
            <h2 className="text-gray-900 font-bold text-xl">Floors</h2>
            <p className="text-gray-500 text-sm mt-0.5">{building.buildingName}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onAddFloor} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2">
              <span>+</span> Add Floor
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">✕</button>
          </div>
        </div>
        <div className="p-6">
          {floors.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🏗️</div>
              <p className="text-gray-400 text-lg">No floors available</p>
              <p className="text-gray-400 text-sm mt-1">Click "Add Floor" to create one</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...floors].sort((a, c) => a.floorNumber - c.floorNumber).map((floor) => {
                const totalRooms = floor.rooms?.length || 0;
                const totalBeds = floor.rooms?.reduce((a, r) => a + (r.beds?.length || 0), 0) || 0;
            return (
  <div key={floor._id} className="group relative p-5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all bg-white">
    {/* Edit / Delete buttons */}
    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      <button
        title="Edit floor"
        onClick={(e) => { e.stopPropagation(); onEditFloor(floor); }}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm transition-colors"
      >✎</button>
      <button
        title="Delete floor"
        onClick={(e) => { e.stopPropagation(); onDeleteFloor(floor._id); }}
        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-sm transition-colors"
      >🗑</button>
    </div>

    {/* Card content — click opens rooms */}
    <div onClick={() => onSelectFloor(floor)} className="cursor-pointer">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div>
            <h3 className="font-bold text-gray-800 text-lg">Floor {floor.floorNumber}</h3>
            {floor.floorName && (
              <p className="text-gray-500 text-sm mt-0.5">{floor.floorName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-3xl">🏢</span>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-3 mb-3">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-lg">
          <span className="text-blue-600 text-sm">🚪</span>
          <span className="text-sm font-medium text-gray-700">{totalRooms} {totalRooms === 1 ? 'room' : 'rooms'}</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 rounded-lg">
          <span className="text-purple-600 text-sm">🛏️</span>
          <span className="text-sm font-medium text-gray-700">{totalBeds} {totalBeds === 1 ? 'bed' : 'beds'}</span>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-medium">
          Click to view rooms 
          <span className="transform group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>
    </div>
  </div>
);
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Room Selection Modal ─────────────────────────────────────────────────────
function RoomModal({ floor, rooms, onSelectRoom, onAddRoom, onEditRoom, onDeleteRoom, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div>
            <h2 className="text-gray-900 font-bold text-xl">Rooms</h2>
            <p className="text-gray-500 text-sm mt-0.5">Floor {floor.floorNumber} {floor.floorName && `· ${floor.floorName}`}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onAddRoom} className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all flex items-center gap-2">
              <span>+</span> Add Room
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">✕</button>
          </div>
        </div>
        <div className="p-6">
          {rooms.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🚪</div>
              <p className="text-gray-400 text-lg">No rooms available</p>
              <p className="text-gray-400 text-sm mt-1">Click "Add Room" to create one</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {rooms.map((room) => {
                const occupied = room.beds.filter((b) => b.status === "Occupied").length;
                const occupancyRate = (occupied / room.beds.length) * 100;
                return (
                  <div key={room._id} className="group relative p-5 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg transition-all bg-white">
                    {/* Edit / Delete buttons */}
                    <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        title="Edit room"
                        onClick={(e) => { e.stopPropagation(); onEditRoom(room); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 text-sm transition-colors"
                      >✎</button>
                      <button
                        title="Delete room"
                        onClick={(e) => { e.stopPropagation(); onDeleteRoom(room._id); }}
                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 text-sm transition-colors"
                      >🗑</button>
                    </div>

                    {/* Card content — click opens beds */}
                    <div onClick={() => onSelectRoom(room)} className="cursor-pointer pr-16">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">🚪</span>
                          <span className="font-bold text-gray-800 text-lg">Room {room.roomNumber}</span>
                        </div>
                        <Badge className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-semibold">{room.shareType}-share</Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mt-4">
                        {room.beds.map((bed) => (
                          <div key={bed._id} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs font-semibold transition-all ${bed.status === "Occupied" ? "bg-red-100 border-2 border-red-400 text-red-700" : "bg-green-100 border-2 border-green-400 text-green-700"}`}>
                            <span className="text-lg">🛏️</span>
                            <span>{bed.bedNumber}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 flex justify-between items-center">
                        <span className="text-sm text-gray-500 font-medium">{occupied}/{room.beds.length} occupied</span>
                        <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-300" style={{ width: `${occupancyRate}%` }}></div>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">Click to view beds <span>→</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bed Details Modal ────────────────────────────────────────────────────────
function BedDetailsModal({ room, onSelectBed, onAddBed, onRemoveBed, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl animate-slideUp" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
          <div>
            <h2 className="text-gray-900 font-bold text-xl">Beds</h2>
            <p className="text-gray-500 text-sm mt-0.5">Room {room.roomNumber} · {room.shareType}-Share</p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={onAddBed}
              title="Add a bed"
              className="px-3 py-1.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl text-sm font-semibold hover:shadow-md transition-all flex items-center gap-1"
            >
              <span>+</span> Add Bed
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">✕</button>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {room.beds.map((bed) => (
              <div
                key={bed._id}
                className={`group relative p-4 rounded-xl text-center transition-all hover:scale-105 ${
                  bed.status === "Occupied"
                    ? "bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg hover:shadow-xl cursor-pointer"
                    : "bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg hover:shadow-xl"
                }`}
                onClick={() => bed.status === "Occupied" && onSelectBed(bed)}
              >
                {/* Remove button — only for available beds */}
                {bed.status === "Available" && (
                  <button
                    title="Remove this bed"
                    onClick={(e) => { e.stopPropagation(); onRemoveBed(bed); }}
                    className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full bg-white/30 hover:bg-red-200 hover:text-red-700 text-white text-xs opacity-0 group-hover:opacity-100 transition-all"
                  >✕</button>
                )}
                <div className="text-4xl mb-2">🛏️</div>
                <div className="font-bold text-lg">Bed {bed.bedNumber}</div>
                <div className="text-xs mt-1 opacity-90 font-medium">{bed.status === "Occupied" ? "Occupied" : "Available"}</div>
                {bed.status === "Occupied" && (
                  <div className="text-xs mt-2 opacity-80 group-hover:opacity-100 transition-opacity">Click to view tenant →</div>
                )}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">Hover a bed to see options · Click occupied bed to view tenant</p>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────
function StatsCards({ stats, selectedBuilding }) {
return (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
    {/* Total Buildings Card */}
    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity"></div>
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
            🏢
          </div>
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">Total</span>
        </div>
        <div className="mb-2">
          <span className="text-3xl font-bold text-gray-800">{stats.totalBuildings}</span>
          <span className="text-gray-500 ml-1">buildings</span>
        </div>
        {selectedBuilding && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-blue-600">✓</span>
              <span className="text-gray-600 truncate">Selected: {selectedBuilding.buildingName}</span>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Total Floors Card */}
    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="absolute top-0 right-0 w-32 h-32 bg-green-500 rounded-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity"></div>
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
            📊
          </div>
          <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">Total</span>
        </div>
        <div className="mb-2">
          <span className="text-3xl font-bold text-gray-800">{stats.totalFloors}</span>
          <span className="text-gray-500 ml-1">floors</span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Across all buildings</span>
            <span className="text-green-600">↑ {Math.round(stats.totalFloors / stats.totalBuildings)} avg</span>
          </div>
        </div>
      </div>
    </div>

    {/* Total Rooms Card */}
    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500 rounded-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity"></div>
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
            🚪
          </div>
          <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded-full">Total</span>
        </div>
        <div className="mb-2">
          <span className="text-3xl font-bold text-gray-800">{stats.totalRooms}</span>
          <span className="text-gray-500 ml-1">rooms</span>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Available spaces</span>
            <span className="text-purple-600">{Math.round(stats.totalRooms / stats.totalFloors)} rooms/floor</span>
          </div>
        </div>
      </div>
    </div>

    {/* Total Beds Card */}
    <div className="group relative overflow-hidden bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500 rounded-full -mr-16 -mt-16 opacity-10 group-hover:opacity-20 transition-opacity"></div>
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center text-2xl">
            🛏️
          </div>
          <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded-full">Capacity</span>
        </div>
        <div className="mb-2">
          <span className="text-3xl font-bold text-gray-800">{stats.totalBeds}</span>
          <span className="text-gray-500 ml-1">total beds</span>
        </div>
        
        {/* Occupancy Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Occupancy</span>
            <span className="font-semibold text-orange-600">
              {Math.round((stats.occupiedBeds / stats.totalBeds) * 100)}%
            </span>
          </div>
          <div className="w-full bg-orange-100 rounded-full h-2 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-orange-500 to-orange-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(stats.occupiedBeds / stats.totalBeds) * 100}%` }}
            ></div>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-gray-600">
              <span className="font-semibold">{stats.occupiedBeds}</span> occupied
            </span>
            <span className="text-gray-500">
              {stats.totalBeds - stats.occupiedBeds} available
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AddHostel() {
  const [buildings, setBuildings] = useState([]);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [stats, setStats] = useState({ totalBuildings: 0, totalFloors: 0, totalRooms: 0, totalBeds: 0, occupiedBeds: 0 });
  const [popupStack, setPopupStack] = useState([]);
  const { toast, show } = useToast();

  const [bForm, setBForm] = useState({ buildingName: "", address: "" });
  const [fForm, setFForm] = useState({ floorNumber: "", floorName: "" });
  const [rForm, setRForm] = useState({ roomNumber: "", shareType: "2" });

  const [showBModal, setShowBModal] = useState(false);
  const [showFModal, setShowFModal] = useState(false);
  const [showRModal, setShowRModal] = useState(false);
  const [editBuilding, setEditBuilding] = useState(null);
  const [editFloor, setEditFloor] = useState(null);   // null = add mode, object = edit mode
  const [editRoom, setEditRoom] = useState(null);     // null = add mode, object = edit mode

  // ── Helpers ──
  const computeStats = (buildingsData, filterBuilding = null) => {
    const list = filterBuilding ? [filterBuilding] : buildingsData;
    let totalFloors = 0, totalRooms = 0, totalBeds = 0, occupiedBeds = 0;
    list.forEach((b) => {
      totalFloors += b.floors?.length || 0;
      b.floors?.forEach((f) => {
        totalRooms += f.rooms?.length || 0;
        f.rooms?.forEach((r) => {
          totalBeds += r.beds?.length || 0;
          occupiedBeds += r.beds?.filter((bed) => bed.status === "Occupied").length || 0;
        });
      });
    });
    return { totalBuildings: list.length, totalFloors, totalRooms, totalBeds, occupiedBeds };
  };

  const fetchBuildings = async () => {
    const r = await fetch(`${API}/buildings`, { headers: authHeaders() });
    const d = await r.json();
    const buildingsData = Array.isArray(d) ? d : [];
    setBuildings(buildingsData);
    if (selectedBuilding) {
      const fresh = buildingsData.find((b) => b._id === selectedBuilding._id);
      if (fresh) {
        setSelectedBuilding(fresh);
        setStats(computeStats(buildingsData, fresh));
      } else {
        setStats(computeStats(buildingsData));
      }
    } else {
      setStats(computeStats(buildingsData));
    }
    return buildingsData;
  };

  useEffect(() => { fetchBuildings(); }, []);

  // ── Card click (NOT "Open Building") → select + update stats only ──
  const handleCardClick = (building) => {
    if (selectedBuilding?._id === building._id) {
      setSelectedBuilding(null);
      setSelectedFloor(null);
      setSelectedRoom(null);
      setStats(computeStats(buildings));
    } else {
      setSelectedBuilding(building);
      setSelectedFloor(null);
      setSelectedRoom(null);
      setStats(computeStats(buildings, building));
    }
    setPopupStack([]);
  };

  // ── "Open Building →" button → open floors popup ──
  const handleBuildingSelect = (building) => {
    setSelectedBuilding(building);
    setSelectedFloor(null);
    setSelectedRoom(null);
    setStats(computeStats(buildings, building));
    setPopupStack([{ type: "floors", building }]);
  };

  const handleFloorSelect = (floor) => {
    setSelectedFloor(floor);
    setSelectedRoom(null);
    setPopupStack([{ type: "rooms", floor, building: selectedBuilding }]);
  };

  const handleRoomSelect = (room) => {
    setSelectedRoom(room);
    setPopupStack([{ type: "beds", room }]);
  };

  const handleBedSelect = async (bed) => {
    if (bed.status === "Occupied" && bed.tenantId) {
      try {
        const r = await fetch(`${API}/tenants/${bed.tenantId}`, { headers: authHeaders() });
        const tenant = await r.json();
        if (r.ok) { setSelectedTenant(tenant); setPopupStack([]); }
      } catch (error) { console.error("Error fetching tenant:", error); }
    }
  };

  const closePopup = () => setPopupStack([]);

  // ── Helper: refresh and re-open floors popup ──
  const refreshAndReopenFloors = async () => {
    const updated = await fetchBuildings();
    const freshBuilding = updated?.find((b) => b._id === selectedBuilding._id);
    if (freshBuilding) {
      setSelectedBuilding(freshBuilding);
      setPopupStack([]);
      setTimeout(() => setPopupStack([{ type: "floors", building: freshBuilding }]), 100);
    }
  };

  // ── Helper: refresh and re-open rooms popup ──
  const refreshAndReopenRooms = async () => {
    const updated = await fetchBuildings();
    const freshBuilding = updated?.find((b) => b._id === selectedBuilding._id);
    if (freshBuilding) {
      const freshFloor = freshBuilding.floors.find((f) => f._id === selectedFloor._id);
      setSelectedBuilding(freshBuilding);
      if (freshFloor) {
        setSelectedFloor(freshFloor);
        setPopupStack([]);
        setTimeout(() => setPopupStack([{ type: "rooms", floor: freshFloor, building: freshBuilding }]), 100);
      }
    }
  };

  // ── Helper: refresh and re-open beds popup ──
  const refreshAndReopenBeds = async () => {
    const updated = await fetchBuildings();
    const freshBuilding = updated?.find((b) => b._id === selectedBuilding._id);
    if (freshBuilding) {
      const freshFloor = freshBuilding.floors.find((f) => f._id === selectedFloor._id);
      if (freshFloor) {
        const freshRoom = freshFloor.rooms.find((r) => r._id === selectedRoom._id);
        setSelectedBuilding(freshBuilding);
        setSelectedFloor(freshFloor);
        if (freshRoom) {
          setSelectedRoom(freshRoom);
          setPopupStack([]);
          setTimeout(() => setPopupStack([{ type: "beds", room: freshRoom }]), 100);
        }
      }
    }
  };

  // ── CRUD: Building ──
  const handleAddBuilding = async () => {
    if (!bForm.buildingName.trim()) return show("Building name required", "error");
    const url = editBuilding ? `${API}/buildings/${editBuilding._id}` : `${API}/buildings`;
    const method = editBuilding ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(bForm) });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show(editBuilding ? "Building updated" : "Building added");
    setBForm({ buildingName: "", address: "" }); setEditBuilding(null); setShowBModal(false);
    fetchBuildings();
  };

  const handleDeleteBuilding = async (id) => {
    if (!window.confirm("Delete this building and all its data?")) return;
    const r = await fetch(`${API}/buildings/${id}`, { method: "DELETE", headers: authHeaders() });
    if (!r.ok) return show("Delete failed", "error");
    show("Building deleted");
    if (selectedBuilding?._id === id) {
      setSelectedBuilding(null); setSelectedFloor(null); setSelectedRoom(null);
    }
    fetchBuildings();
  };

  // ── CRUD: Floor ──
  const handleAddFloor = async () => {
    if (!fForm.floorNumber.toString().trim()) return show("Floor number required", "error");

    let r;
    if (editFloor) {
      // Edit existing floor
      r = await fetch(`${API}/buildings/${selectedBuilding._id}/floors/${editFloor._id}`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify({ floorNumber: Number(fForm.floorNumber), floorName: fForm.floorName }),
      });
    } else {
      // Add new floor
      r = await fetch(`${API}/buildings/${selectedBuilding._id}/floors`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ floorNumber: Number(fForm.floorNumber), floorName: fForm.floorName }),
      });
    }

    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show(editFloor ? "Floor updated" : "Floor added");
    setFForm({ floorNumber: "", floorName: "" }); setEditFloor(null); setShowFModal(false);
    await refreshAndReopenFloors();
  };

  const handleDeleteFloor = async (floorId) => {
    if (!window.confirm("Delete this floor and all its rooms/beds?")) return;
    const r = await fetch(`${API}/buildings/${selectedBuilding._id}/floors/${floorId}`, {
      method: "DELETE", headers: authHeaders(),
    });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show("Floor deleted");
    await refreshAndReopenFloors();
  };

  // ── CRUD: Room ──
  const handleAddRoom = async () => {
    if (!rForm.roomNumber.trim()) return show("Room number required", "error");

    let r;
    if (editRoom) {
      // Edit existing room
      r = await fetch(`${API}/buildings/${selectedBuilding._id}/floors/${selectedFloor._id}/rooms/${editRoom._id}`, {
        method: "PUT", headers: authHeaders(),
        body: JSON.stringify({ roomNumber: rForm.roomNumber, shareType: Number(rForm.shareType) }),
      });
    } else {
      // Add new room
      r = await fetch(`${API}/buildings/${selectedBuilding._id}/floors/${selectedFloor._id}/rooms`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ roomNumber: rForm.roomNumber, shareType: Number(rForm.shareType) }),
      });
    }

    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show(editRoom ? "Room updated" : "Room added");
    setRForm({ roomNumber: "", shareType: "2" }); setEditRoom(null); setShowRModal(false);
    await refreshAndReopenRooms();
  };

  const handleDeleteRoom = async (roomId) => {
    if (!window.confirm("Delete this room and all its beds?")) return;
    const r = await fetch(`${API}/buildings/${selectedBuilding._id}/floors/${selectedFloor._id}/rooms/${roomId}`, {
      method: "DELETE", headers: authHeaders(),
    });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show("Room deleted");
    await refreshAndReopenRooms();
  };

  // ── CRUD: Beds (via room shareType) ──
  const handleAddBed = async () => {
    const newShareType = selectedRoom.beds.length + 1;
    const r = await fetch(`${API}/buildings/${selectedBuilding._id}/floors/${selectedFloor._id}/rooms/${selectedRoom._id}`, {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ roomNumber: selectedRoom.roomNumber, shareType: newShareType }),
    });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show("Bed added");
    await refreshAndReopenBeds();
  };

  const handleRemoveBed = async (bed) => {
    if (bed.status === "Occupied") return show("Cannot remove an occupied bed", "error");
    if (!window.confirm(`Remove Bed ${bed.bedNumber}?`)) return;
    const newShareType = selectedRoom.beds.length - 1;
    if (newShareType < 1) return show("A room must have at least 1 bed", "error");
    const r = await fetch(`${API}/buildings/${selectedBuilding._id}/floors/${selectedFloor._id}/rooms/${selectedRoom._id}`, {
      method: "PUT", headers: authHeaders(),
      body: JSON.stringify({ roomNumber: selectedRoom.roomNumber, shareType: newShareType }),
    });
    const d = await r.json();
    if (!r.ok) return show(d.message, "error");
    show("Bed removed");
    await refreshAndReopenBeds();
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Toast toast={toast} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Property Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage buildings, floors, rooms and bed allocations</p>
        </div>
        <button
          onClick={() => { setEditBuilding(null); setBForm({ buildingName: "", address: "" }); setShowBModal(true); }}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all hover:scale-105"
        >
          + New Building
        </button>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} selectedBuilding={selectedBuilding} />

      {/* Building Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {buildings.map((building) => {
          const totalRooms = building.floors?.reduce((a, f) => a + f.rooms.length, 0) || 0;
          const totalBeds = building.floors?.reduce((a, f) => a + f.rooms.reduce((x, r) => x + r.beds.length, 0), 0) || 0;
          const isSelected = selectedBuilding?._id === building._id;

          return (
            <div
              key={building._id}
              onClick={() => handleCardClick(building)}
              className={`relative p-5 rounded-xl transition-all cursor-pointer ${
                isSelected
                  ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg scale-105"
                  : "bg-white border-2 border-gray-200 hover:border-blue-400 hover:shadow-lg"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className={`font-bold text-lg ${isSelected ? "text-white" : "text-gray-800"}`}>
                    {building.buildingName}
                  </h3>
                  {building.address && (
                    <p className={`text-xs mt-1 ${isSelected ? "text-blue-100" : "text-gray-500"}`}>
                      {building.address}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    className={`p-1 rounded transition-colors ${isSelected ? "hover:bg-white/20 text-white" : "hover:bg-gray-100 text-gray-500"}`}
                    onClick={(e) => { e.stopPropagation(); setEditBuilding(building); setBForm({ buildingName: building.buildingName, address: building.address || "" }); setShowBModal(true); }}
                  >✎</button>
                  <button
                    className={`p-1 rounded transition-colors ${isSelected ? "hover:bg-white/20 text-white" : "hover:bg-red-100 text-red-500"}`}
                    onClick={(e) => { e.stopPropagation(); handleDeleteBuilding(building._id); }}
                  >✕</button>
                </div>
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                <span className={`text-xs px-2 py-1 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>{building.floors?.length || 0} floors</span>
                <span className={`text-xs px-2 py-1 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-green-100 text-green-700"}`}>{totalRooms} rooms</span>
                <span className={`text-xs px-2 py-1 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"}`}>{totalBeds} beds</span>
              </div>

              {/* Open Building button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleBuildingSelect(building); }}
                className={`mt-4 w-full py-2 rounded-lg font-medium transition-all ${
                  isSelected
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700"
                }`}
              >
                {isSelected ? "Open Building" : "Open Building →"}
              </button>

              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Add / Edit Building Modal ── */}
      <FormModal
        open={showBModal}
        onClose={() => setShowBModal(false)}
        title={editBuilding ? "Edit Building" : "Add Building"}
        subtitle={editBuilding ? `Editing: ${editBuilding.buildingName}` : "Create a new property"}
        icon={editBuilding ? "✎" : "🏢"}
      >
        <div className="space-y-5">
          <FormField label="Building Name" required>
            <input
              className={fieldStyle}
              value={bForm.buildingName}
              onChange={(e) => setBForm({ ...bForm, buildingName: e.target.value })}
              placeholder="e.g. Block A, Sunrise PG"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleAddBuilding()}
            />
          </FormField>
          <FormField label="Address">
            <input
              className={fieldStyle}
              value={bForm.address}
              onChange={(e) => setBForm({ ...bForm, address: e.target.value })}
              placeholder="Full address (optional)"
            />
          </FormField>
          <FormActions
            onCancel={() => { setShowBModal(false); setEditBuilding(null); }}
            onSubmit={handleAddBuilding}
            submitLabel={editBuilding ? "Update Building" : "Add Building"}
          />
        </div>
      </FormModal>

      {/* ── Add / Edit Floor Modal ── */}
      {selectedBuilding && (
        <FormModal
          open={showFModal}
          onClose={() => { setShowFModal(false); setEditFloor(null); }}
          title={editFloor ? "Edit Floor" : "Add Floor"}
          subtitle={editFloor ? `Editing Floor ${editFloor.floorNumber} · ${selectedBuilding.buildingName}` : selectedBuilding.buildingName}
          icon={editFloor ? "✎" : "📐"}
        >
          <div className="space-y-5">
            <FormField label="Floor Number" required>
              <input
                className={fieldStyle}
                type="number"
                value={fForm.floorNumber}
                onChange={(e) => setFForm({ ...fForm, floorNumber: e.target.value })}
                placeholder="e.g. 1"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleAddFloor()}
              />
            </FormField>
            <FormField label="Floor Name">
              <input
                className={fieldStyle}
                value={fForm.floorName}
                onChange={(e) => setFForm({ ...fForm, floorName: e.target.value })}
                placeholder="e.g. Ground Floor (optional)"
              />
            </FormField>
            <FormActions
              onCancel={() => { setShowFModal(false); setEditFloor(null); }}
              onSubmit={handleAddFloor}
              submitLabel={editFloor ? "Update Floor" : "Add Floor"}
            />
          </div>
        </FormModal>
      )}

      {/* ── Add / Edit Room Modal ── */}
      {selectedFloor && (
        <FormModal
          open={showRModal}
          onClose={() => { setShowRModal(false); setEditRoom(null); }}
          title={editRoom ? "Edit Room" : "Add Room"}
          subtitle={
            editRoom
              ? `Editing Room ${editRoom.roomNumber} · Floor ${selectedFloor.floorNumber}`
              : `Floor ${selectedFloor.floorNumber}${selectedFloor.floorName ? ` · ${selectedFloor.floorName}` : ""}`
          }
          icon={editRoom ? "✎" : "🚪"}
        >
          <div className="space-y-5">
            <FormField label="Room Number" required>
              <input
                className={fieldStyle}
                value={rForm.roomNumber}
                onChange={(e) => setRForm({ ...rForm, roomNumber: e.target.value })}
                placeholder="e.g. 101"
                autoFocus
              />
            </FormField>
            <FormField label="Share Type" required>
              <select
                className={fieldStyle}
                value={rForm.shareType}
                onChange={(e) => setRForm({ ...rForm, shareType: e.target.value })}
              >
                {SHARE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} Share ({n} Bed{n > 1 ? "s" : ""})</option>
                ))}
              </select>
            </FormField>
            {/* Bed preview */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Bed Preview</p>
              <div className="flex gap-2 flex-wrap">
                {Array.from({ length: Number(rForm.shareType) }, (_, i) => (
                  <div key={i} className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex flex-col items-center justify-center text-white shadow-sm">
                    <span className="text-base leading-none">🛏️</span>
                    <span className="text-xs font-bold mt-0.5">{i + 1}</span>
                  </div>
                ))}
              </div>
              {editRoom && Number(rForm.shareType) < editRoom.beds.filter(b => b.status === "Occupied").length && (
                <p className="text-xs text-red-500 mt-2">⚠️ You cannot reduce below the number of occupied beds.</p>
              )}
            </div>
            <FormActions
              onCancel={() => { setShowRModal(false); setEditRoom(null); }}
              onSubmit={handleAddRoom}
              submitLabel={editRoom ? "Update Room" : "Add Room"}
            />
          </div>
        </FormModal>
      )}

      {/* ── Popup Stack ── */}
      {popupStack.length > 0 && popupStack[popupStack.length - 1].type === "floors" && (
        <FloorModal
          building={selectedBuilding}
          floors={selectedBuilding?.floors || []}
          onSelectFloor={handleFloorSelect}
          onAddFloor={() => { setEditFloor(null); setFForm({ floorNumber: "", floorName: "" }); setShowFModal(true); }}
          onEditFloor={(floor) => {
            setEditFloor(floor);
            setFForm({ floorNumber: floor.floorNumber.toString(), floorName: floor.floorName || "" });
            setShowFModal(true);
          }}
          onDeleteFloor={handleDeleteFloor}
          onClose={closePopup}
        />
      )}
      {popupStack.length > 0 && popupStack[popupStack.length - 1].type === "rooms" && (
        <RoomModal
          floor={selectedFloor}
          rooms={selectedFloor?.rooms || []}
          onSelectRoom={handleRoomSelect}
          onAddRoom={() => { setEditRoom(null); setRForm({ roomNumber: "", shareType: "2" }); setShowRModal(true); }}
          onEditRoom={(room) => {
            setEditRoom(room);
            setRForm({ roomNumber: room.roomNumber, shareType: room.shareType.toString() });
            setShowRModal(true);
          }}
          onDeleteRoom={handleDeleteRoom}
          onClose={closePopup}
        />
      )}
      {popupStack.length > 0 && popupStack[popupStack.length - 1].type === "beds" && (
        <BedDetailsModal
          room={selectedRoom}
          onSelectBed={handleBedSelect}
          onAddBed={handleAddBed}
          onRemoveBed={handleRemoveBed}
          onClose={closePopup}
        />
      )}

      {/* Tenant Details */}
      {selectedTenant && <BedTenantModal tenant={selectedTenant} onClose={() => setSelectedTenant(null)} />}
    </div>
  );
}

// ─── Animation styles ─────────────────────────────────────────────────────────
const style = document.createElement("style");
style.textContent = `
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(50px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes modalPop {
    from { opacity: 0; transform: scale(0.93) translateY(16px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  .animate-slideUp  { animation: slideUp  0.3s ease-out; }
  .animate-modalPop { animation: modalPop 0.25s cubic-bezier(0.34,1.56,0.64,1); }
`;
document.head.appendChild(style);