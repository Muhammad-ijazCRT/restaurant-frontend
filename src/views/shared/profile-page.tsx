import { useState, useRef, useEffect } from "react";
import { profilePaths } from "@/api/shared/profile";
import { profileKeys } from "@/api/shared/profile";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  Save,
  User,
  Mail,
  Phone,
  Loader2,
  UtensilsCrossed,
  MapPin,
  Clock,
  FileText,
  Building2,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl } from "@/lib/api";
import { getUserData, getUserRole } from "@/lib/portal-auth";
import { formatPhone } from "@shared/schema";
import { OpeningHoursPicker } from "@/components/shared/opening-hours-picker";

const RESTAURANT_TYPES = [
  "Fine Dining",
  "Casual Dining",
  "Fast Food",
  "Cafe",
  "Bakery",
  "Food Truck",
  "Catering",
  "Bar & Grill",
  "Other",
];

const VENDOR_TYPES = [
  "Food Distributor",
  "Produce Supplier",
  "Meat & Seafood",
  "Dairy & Eggs",
  "Beverage Supplier",
  "Bakery Supplier",
  "Dry Goods",
  "Packaging Supplies",
  "Equipment Supplier",
  "Other",
];

function resolveProfileImageUrl(image?: string | null): string | undefined {
  if (!image) return undefined;
  if (image.startsWith("data:") || image.startsWith("http://") || image.startsWith("https://")) {
    return image;
  }
  return apiUrl(image.startsWith("/") ? image : `/${image}`);
}

type ProfileData = {
  name: string;
  email: string;
  phone?: string;
  image?: string;
  role: string;
  contactName?: string | null;
  restaurantType?: string | null;
  vendorType?: string | null;
  address?: string | null;
  aboutRestaurant?: string | null;
  aboutVendor?: string | null;
  openingHours?: string | null;
  operatingHours?: string | null;
};

type ProfileFormData = {
  name: string;
  email: string;
  phone: string;
  image: string;
  contactName: string;
  restaurantType: string;
  vendorType: string;
  address: string;
  aboutRestaurant: string;
  aboutVendor: string;
  openingHours: string;
  operatingHours: string;
};

const emptyForm: ProfileFormData = {
  name: "",
  email: "",
  phone: "",
  image: "",
  contactName: "",
  restaurantType: "",
  vendorType: "",
  address: "",
  aboutRestaurant: "",
  aboutVendor: "",
  openingHours: "",
  operatingHours: "",
};

function profileToForm(profile: ProfileData): ProfileFormData {
  return {
    name: profile.name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    image: profile.image || "",
    contactName: profile.contactName || "",
    restaurantType: profile.restaurantType || "",
    vendorType: profile.vendorType || "",
    address: profile.address || "",
    aboutRestaurant: profile.aboutRestaurant || "",
    aboutVendor: profile.aboutVendor || "",
    openingHours: profile.openingHours || "",
    operatingHours: profile.operatingHours || "",
  };
}

export default function ProfilePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const userData = getUserData();

  const [formData, setFormData] = useState<ProfileFormData>(emptyForm);

  const { data: profile, isLoading } = useQuery<ProfileData>({
    queryKey: profileKeys.profile(),
  });

  const isRestaurantProfile = profile?.role === "restaurant";
  const isVendorProfile = profile?.role === "vendor_admin";
  const isExpandedProfile = isRestaurantProfile || isVendorProfile;

  useEffect(() => {
    if (profile) {
      setFormData(profileToForm(profile));
    }
  }, [profile]);

  useEffect(() => {
    if (!profile) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || userData?.name || "",
        email: prev.email || userData?.email || "",
      }));
    }
  }, [userData?.name, userData?.email, profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const role = getUserRole();
      const payload: Record<string, string | null> = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        image: data.image,
      };

      if (role === "restaurant") {
        payload.restaurantType = data.restaurantType || null;
        payload.address = data.address || null;
        payload.aboutRestaurant = data.aboutRestaurant || null;
        payload.openingHours = data.openingHours || null;
      }

      if (role === "vendor_admin") {
        payload.contactName = data.contactName || null;
        payload.vendorType = data.vendorType || null;
        payload.address = data.address || null;
        payload.aboutVendor = data.aboutVendor || null;
        payload.operatingHours = data.operatingHours || null;
      }

      const res = await apiRequest("PUT", profilePaths.profile, payload);
      return res.json() as Promise<ProfileData & { message?: string }>;
    },
    onSuccess: (data) => {
      const profileData: ProfileData = {
        name: data.name,
        email: data.email,
        phone: data.phone,
        image: data.image,
        role: data.role,
        contactName: data.contactName ?? null,
        restaurantType: data.restaurantType ?? null,
        vendorType: data.vendorType ?? null,
        address: data.address ?? null,
        aboutRestaurant: data.aboutRestaurant ?? null,
        aboutVendor: data.aboutVendor ?? null,
        openingHours: data.openingHours ?? null,
        operatingHours: data.operatingHours ?? null,
      };
      const nextFormData = profileToForm(profileData);
      setFormData(nextFormData);
      queryClient.setQueryData(profileKeys.profile(), profileData);

      const storedUser = getUserData();
      if (storedUser) {
        const updated = {
          ...storedUser,
          name: nextFormData.name,
          email: nextFormData.email,
          phone: nextFormData.phone,
          image: nextFormData.image,
        };
        localStorage.setItem("user_data", JSON.stringify(updated));
      }
      toast({
        title: "Profile Updated",
        description: "Your profile has been saved successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Could not save your profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = String(reader.result);
      setFormData((prev) => ({ ...prev, image: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const initials = formData.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "U";

  const profileTitle = isRestaurantProfile
    ? "Restaurant Profile"
    : isVendorProfile
      ? "Vendor Profile"
      : "My Profile";

  const profileDescription = isRestaurantProfile
    ? "Manage your restaurant information"
    : isVendorProfile
      ? "Manage your vendor company information"
      : "Manage your personal information";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex items-start justify-center">
      <Card className={`w-full shadow-lg ${isExpandedProfile ? "max-w-2xl" : "max-w-lg"}`}>
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl font-bold">{profileTitle}</CardTitle>
          <CardDescription>{profileDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="flex flex-col items-center gap-3">
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <Avatar className="h-28 w-28 border-4 border-background shadow-md">
                  <AvatarImage src={resolveProfileImageUrl(formData.image)} alt={formData.name} />
                  <AvatarFallback className="text-3xl font-semibold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Camera className="h-7 w-7 text-white" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Click to change photo</p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="profile-name" className="flex items-center gap-2 text-sm font-medium">
                  {isRestaurantProfile ? (
                    <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                  ) : isVendorProfile ? (
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground" />
                  )}
                  {isRestaurantProfile ? "Restaurant Name" : isVendorProfile ? "Vendor Name" : "Full Name"}
                </Label>
                <Input
                  id="profile-name"
                  placeholder={
                    isRestaurantProfile
                      ? "Enter restaurant name"
                      : isVendorProfile
                        ? "Enter vendor company name"
                        : "Enter your full name"
                  }
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              {isVendorProfile && (
                <div className="space-y-2">
                  <Label htmlFor="profile-contact-name" className="flex items-center gap-2 text-sm font-medium">
                    <User className="h-4 w-4 text-muted-foreground" /> Contact Name
                  </Label>
                  <Input
                    id="profile-contact-name"
                    placeholder="Primary contact person"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="profile-email" className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Email Address
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-phone" className="flex items-center gap-2 text-sm font-medium">
                  <Phone className="h-4 w-4 text-muted-foreground" /> Phone Number
                </Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={formatPhone(formData.phone)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      phone: e.target.value.replace(/\D/g, "").slice(0, 10),
                    })
                  }
                  required
                />
              </div>

              {isRestaurantProfile && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="profile-restaurant-type" className="flex items-center gap-2 text-sm font-medium">
                      <UtensilsCrossed className="h-4 w-4 text-muted-foreground" /> Restaurant Type
                    </Label>
                    <Select
                      key={formData.restaurantType || "empty"}
                      value={formData.restaurantType || undefined}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, restaurantType: value }))}
                    >
                      <SelectTrigger id="profile-restaurant-type">
                        <SelectValue placeholder="Select restaurant type" />
                      </SelectTrigger>
                      <SelectContent>
                        {RESTAURANT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-address" className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-muted-foreground" /> Address
                    </Label>
                    <Input
                      id="profile-address"
                      placeholder="Street, city, state, zip"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-about-restaurant" className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" /> About Restaurant
                    </Label>
                    <Textarea
                      id="profile-about-restaurant"
                      placeholder="Tell vendors about your restaurant, cuisine, and ordering preferences"
                      value={formData.aboutRestaurant}
                      onChange={(e) => setFormData({ ...formData, aboutRestaurant: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 text-muted-foreground" /> Opening Hours
                    </Label>
                    <OpeningHoursPicker
                      value={formData.openingHours}
                      onChange={(openingHours) => setFormData({ ...formData, openingHours })}
                    />
                  </div>
                </>
              )}

              {isVendorProfile && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="profile-vendor-type" className="flex items-center gap-2 text-sm font-medium">
                      <Truck className="h-4 w-4 text-muted-foreground" /> Vendor Type
                    </Label>
                    <Select
                      key={formData.vendorType || "empty"}
                      value={formData.vendorType || undefined}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, vendorType: value }))}
                    >
                      <SelectTrigger id="profile-vendor-type">
                        <SelectValue placeholder="Select vendor type" />
                      </SelectTrigger>
                      <SelectContent>
                        {VENDOR_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-vendor-address" className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-muted-foreground" /> Address
                    </Label>
                    <Input
                      id="profile-vendor-address"
                      placeholder="Street, city, state, zip"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profile-about-vendor" className="flex items-center gap-2 text-sm font-medium">
                      <FileText className="h-4 w-4 text-muted-foreground" /> About Vendor
                    </Label>
                    <Textarea
                      id="profile-about-vendor"
                      placeholder="Tell restaurants about your company, products, and delivery capabilities"
                      value={formData.aboutVendor}
                      onChange={(e) => setFormData({ ...formData, aboutVendor: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4 text-muted-foreground" /> Operating Hours
                    </Label>
                    <OpeningHoursPicker
                      value={formData.operatingHours}
                      onChange={(operatingHours) => setFormData({ ...formData, operatingHours })}
                    />
                  </div>
                </>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" /> Save Changes
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
