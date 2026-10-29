import React, { useState } from 'react';
import { useStore } from '../../context/StoreContext';
import { CustomerAddress } from '../../types/store';
import {
  ArrowLeft,
  User,
  MapPin,
  ShieldCheck,
  LogOut,
  Plus,
  Trash2,
  CheckCircle,
  Truck,
  Phone,
  Mail,
  Edit2,
  Check,
  X,
  Lock,
} from 'lucide-react';

interface CustomerAccountPageProps {
  onBack?: () => void;
}

export const CustomerAccountPage: React.FC<CustomerAccountPageProps> = ({ onBack }) => {
  const {
    currentCustomer,
    customerLogout,
    updateCustomerProfile,
    addCustomerAddress,
    deleteCustomerAddress,
    setDefaultAddress,
    setCustomerActiveTab,
    setIsCustomerAuthModalOpen,
  } = useStore();

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState(currentCustomer?.name || '');
  const [editPhone, setEditPhone] = useState(currentCustomer?.phone || '');
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);

  // Address Form State
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrName, setAddrName] = useState('');
  const [addrPhone, setAddrPhone] = useState('');
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState('');
  const [addrState, setAddrState] = useState('');
  const [addrPincode, setAddrPincode] = useState('');
  const [addrIsDefault, setAddrIsDefault] = useState(false);

  const handleReturn = () => {
    if (onBack) {
      onBack();
    } else {
      setCustomerActiveTab('categories');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCustomer) return;
    await updateCustomerProfile({
      name: editName.trim(),
      phone: editPhone.trim(),
    });
    setIsEditingProfile(false);
    setProfileSuccessMsg('Profile details updated successfully');
    setTimeout(() => setProfileSuccessMsg(null), 3000);
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet.trim() || !addrCity.trim() || !addrPincode.trim()) return;

    await addCustomerAddress({
      name: addrName.trim() || currentCustomer?.name || 'Patron',
      phone: addrPhone.trim() || currentCustomer?.phone || '',
      address: addrStreet.trim(),
      city: addrCity.trim(),
      state: addrState.trim() || 'Tamil Nadu',
      pincode: addrPincode.trim(),
      isDefault: addrIsDefault || (currentCustomer?.savedAddresses?.length === 0),
    });

    // Reset form
    setAddrName('');
    setAddrPhone('');
    setAddrStreet('');
    setAddrCity('');
    setAddrState('');
    setAddrPincode('');
    setAddrIsDefault(false);
    setShowAddressForm(false);
  };

  const handleLogout = () => {
    customerLogout();
    setCustomerActiveTab('categories');
  };

  if (!currentCustomer) {
    return (
      <div className="min-h-screen pb-28 bg-neutral-50/60 p-6 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-3xl border border-neutral-200 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 text-amber-700 mx-auto flex items-center justify-center">
            <User className="w-8 h-8" />
          </div>
          <h2 className="font-serif font-bold text-xl text-neutral-900">Sign In to Your Account</h2>
          <p className="text-xs text-neutral-500">
            Sign in or register to view your patron profile, manage saved delivery addresses, and ensure isolated data privacy.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCustomerAuthModalOpen(true)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-950 to-rose-900 text-amber-200 font-bold text-xs hover:from-rose-900 hover:to-rose-800 transition cursor-pointer shadow-sm"
            >
              Sign In / Register
            </button>
            <button
              type="button"
              onClick={handleReturn}
              className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-700 font-semibold text-xs hover:bg-neutral-100 transition cursor-pointer"
            >
              Back to Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-neutral-50/60">
      {/* Top Navigation Bar */}
      <div className="sticky top-18 z-30 bg-white/95 backdrop-blur-md border-b border-neutral-200 px-4 py-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleReturn}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-neutral-700 hover:text-neutral-950 px-3 py-1.5 rounded-xl hover:bg-neutral-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-rose-900" />
            <span>Back to Shopping</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log Out</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header Profile Summary Pill */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-[#4a1205] via-[#5c1a08] to-[#3a0d03] text-white shadow-md flex items-center justify-between gap-4 flex-wrap border border-amber-600/40">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-neutral-950 font-serif font-bold text-xl flex items-center justify-center shadow-md ring-2 ring-amber-300/60 shrink-0">
              {currentCustomer.name ? currentCustomer.name.charAt(0).toUpperCase() : 'P'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-serif font-bold text-xl sm:text-2xl text-white">
                  {currentCustomer.name}
                </h1>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-neutral-900 shrink-0" title="Online & Active" />
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/40 uppercase tracking-wider">
                  Patron Member
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-0.5">
                {currentCustomer.phone ? `+91 ${currentCustomer.phone}` : currentCustomer.email}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-amber-300/80 block">Customer ID</span>
            <span className="font-mono text-xs text-amber-100 bg-black/30 px-2 py-1 rounded border border-white/10">
              {currentCustomer.id.slice(0, 14)}
            </span>
          </div>
        </div>

        {profileSuccessMsg && (
          <div className="p-3 px-4 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{profileSuccessMsg}</span>
          </div>
        )}

        {/* SECTION 1: USER DETAILS */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-amber-700" />
              <h2 className="font-serif font-bold text-base text-neutral-900">
                User Details
              </h2>
            </div>
            {!isEditingProfile && (
              <button
                type="button"
                onClick={() => {
                  setEditName(currentCustomer.name);
                  setEditPhone(currentCustomer.phone);
                  setIsEditingProfile(true);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-900 hover:text-rose-700 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          {isEditingProfile ? (
            <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">
                    Mobile Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-3.5 py-2 rounded-xl border border-neutral-300 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-neutral-300 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Full Name</span>
                <p className="font-bold text-neutral-900 text-sm">{currentCustomer.name}</p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Registered Phone</span>
                <p className="font-semibold text-neutral-900 text-xs flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-neutral-400" />
                  <span>+91 {currentCustomer.phone || 'Not linked'}</span>
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-100 space-y-1">
                <span className="text-[10px] uppercase font-bold text-neutral-400 block">Email Address</span>
                <p className="font-semibold text-neutral-900 text-xs truncate flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-neutral-400" />
                  <span>{currentCustomer.email || 'Phone registered'}</span>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: SAVED ADDRESSES */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-800" />
              <div>
                <h2 className="font-serif font-bold text-base text-neutral-900">
                  Saved Addresses
                </h2>
                <p className="text-[11px] text-neutral-500">
                  Manage shipping destinations for instant 1-click checkout
                </p>
              </div>
            </div>

            {!showAddressForm && (
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 px-3.5 py-1.5 rounded-xl transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Address</span>
              </button>
            )}
          </div>

          {/* New Address Form */}
          {showAddressForm && (
            <form onSubmit={handleAddAddress} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
              <h3 className="font-serif font-bold text-xs text-neutral-900">Add New Shipping Address</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    value={addrName}
                    onChange={(e) => setAddrName(e.target.value)}
                    placeholder="e.g. Nandha Goban"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">Mobile Phone *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={addrPhone}
                    onChange={(e) => setAddrPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile number"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-700 mb-1">Street Address, House No, Area *</label>
                <textarea
                  rows={2}
                  required
                  value={addrStreet}
                  onChange={(e) => setAddrStreet(e.target.value)}
                  placeholder="Flat 204, Royal Apartments, 2nd Main Road"
                  className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={addrCity}
                    onChange={(e) => setAddrCity(e.target.value)}
                    placeholder="Salem / Chennai"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={addrState}
                    onChange={(e) => setAddrState(e.target.value)}
                    placeholder="Tamil Nadu"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-neutral-700 mb-1">Pincode *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={addrPincode}
                    onChange={(e) => setAddrPincode(e.target.value.replace(/\D/g, ''))}
                    placeholder="636001"
                    className="w-full px-3 py-2 rounded-xl border border-neutral-300 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs text-neutral-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addrIsDefault}
                    onChange={(e) => setAddrIsDefault(e.target.checked)}
                    className="rounded text-rose-900"
                  />
                  <span>Set as default address</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddressForm(false)}
                    className="px-3 py-1.5 text-xs text-neutral-600 hover:text-neutral-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-xl bg-neutral-900 text-white font-bold text-xs"
                  >
                    Save Address
                  </button>
                </div>
              </div>
            </form>
          )}

          {(!currentCustomer.savedAddresses || currentCustomer.savedAddresses.length === 0) && !showAddressForm ? (
            <div className="text-center py-8 bg-neutral-50 rounded-2xl border border-neutral-200/80 p-6 space-y-2">
              <MapPin className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-xs text-neutral-500">No saved delivery addresses.</p>
              <button
                type="button"
                onClick={() => setShowAddressForm(true)}
                className="text-xs font-bold text-rose-900 hover:underline"
              >
                + Add your primary shipping address
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentCustomer.savedAddresses?.map((addr) => (
                <div
                  key={addr.id}
                  className={`p-4 rounded-2xl bg-white border transition relative ${
                    addr.isDefault
                      ? 'border-rose-900 ring-2 ring-rose-900/10 shadow-xs'
                      : 'border-neutral-200/80'
                  }`}
                >
                  {addr.isDefault && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-900">
                      Default
                    </span>
                  )}
                  <p className="font-bold text-xs text-neutral-900">{addr.name}</p>
                  <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                    {addr.address}, {addr.city}, {addr.state} - <strong>{addr.pincode}</strong>
                  </p>
                  <p className="text-[11px] text-neutral-500 mt-1">📱 +91 {addr.phone}</p>

                  <div className="mt-3 pt-2 border-t border-neutral-100 flex items-center justify-between">
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => setDefaultAddress(addr.id)}
                        className="text-[11px] font-bold text-rose-900 hover:text-rose-700 cursor-pointer"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteCustomerAddress(addr.id)}
                      className="text-[11px] text-neutral-400 hover:text-rose-600 flex items-center gap-1 ml-auto cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 3: PROFILE PRIVACY */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <h2 className="font-serif font-bold text-base text-neutral-900">
              Profile Privacy & Data Isolation
            </h2>
          </div>

          <div className="space-y-3 text-xs text-neutral-600">
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-neutral-900">Strict Patron Isolation</h4>
                <p className="mt-0.5 leading-relaxed text-neutral-600">
                  Your saved addresses, contact numbers, and 12-digit payment reference records are cryptographically bound to your customer profile. No other customer or guest visitor can view your personal details.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80 flex items-start gap-3">
              <Truck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-xs text-neutral-900">Encrypted Courier Dispatch</h4>
                <p className="mt-0.5 leading-relaxed text-neutral-600">
                  Shipping addresses are shared exclusively with trusted courier partners (DTDC, Blue Dart, Speed Post) strictly for order delivery purposes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: LOG OUT OPTION */}
        <div className="bg-white rounded-3xl border border-neutral-200 p-6 shadow-2xs flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-serif font-bold text-sm text-neutral-900">End Patron Session</h3>
            <p className="text-xs text-neutral-500">
              Log out of this device. Your saved addresses and orders remain securely stored in your account.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-4 h-4" />
            <span>Log Out of Account</span>
          </button>
        </div>
      </div>
    </div>
  );
};
