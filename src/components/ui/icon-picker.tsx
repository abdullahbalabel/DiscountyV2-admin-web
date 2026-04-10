"use client";

import { useState, useRef, useEffect } from "react";
import { Icon } from "@iconify-icon/react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CATEGORY_ICONS = [
  // Food & Drink
  "material-symbols:restaurant",
  "material-symbols:local-cafe",
  "material-symbols:local-pizza",
  "material-symbols:fastfood",
  "material-symbols:local-dining",
  "material-symbols:local-bar",
  "material-symbols:liquor",
  "material-symbols:cake",
  "material-symbols:bakery-dining",
  "material-symbols:lunch-dining",
  "material-symbols:dinner-dining",
  "material-symbols:ramen-dining",
  "material-symbols:set-meal",
  "material-symbols:rice-bowl",
  "material-symbols:icecream",
  "material-symbols:local-drink",
  "material-symbols:emoji-food-beverage",
  "material-symbols:egg",
  "material-symbols:kebab-dining",
  "material-symbols:soup-kitchen",
  // Shopping
  "material-symbols:shopping-cart",
  "material-symbols:shopping-bag",
  "material-symbols:store",
  "material-symbols:storefront",
  "material-symbols:local-mall",
  "material-symbols:local-offer",
  "material-symbols:confirmation-number",
  "material-symbols:sell",
  "material-symbols:redeem",
  "material-symbols:loyalty",
  "material-symbols:receipt-long",
  "material-symbols:barcode-scanner",
  "material-symbols:price-check",
  // Health & Beauty
  "material-symbols:spa",
  "material-symbols:face",
  "material-symbols:fitness-center",
  "material-symbols:local-hospital",
  "material-symbols:local-pharmacy",
  "material-symbols:healing",
  "material-symbols:health-and-safety",
  "material-symbols:medical-services",
  "material-symbols:brush",
  "material-symbols:content-cut",
  "material-symbols:palette",
  "material-symbols:checkroom",
  "material-symbols:diamond",
  "material-symbols:watch",
  "material-symbols:eyeglasses",
  "material-symbols:local-florist",
  "material-symbols:water-drop",
  "material-symbols:sanitizer",
  "material-symbols:masks",
  // Travel & Transport
  "material-symbols:flight",
  "material-symbols:hotel",
  "material-symbols:directions-car",
  "material-symbols:directions-bus",
  "material-symbols:local-taxi",
  "material-symbols:train",
  "material-symbols:navigation",
  "material-symbols:place",
  "material-symbols:map",
  "material-symbols:explore",
  "material-symbols:local-airport",
  "material-symbols:directions-bike",
  "material-symbols:directions-walk",
  "material-symbols:beach-access",
  "material-symbols:luggage",
  "material-symbols:compass-calibration",
  "material-symbols:rv-hookup",
  // Entertainment
  "material-symbols:sports-esports",
  "material-symbols:sports-soccer",
  "material-symbols:sports-basketball",
  "material-symbols:sports-tennis",
  "material-symbols:sports-volleyball",
  "material-symbols:sports-baseball",
  "material-symbols:sports-football",
  "material-symbols:sports-handball",
  "material-symbols:sports-mma",
  "material-symbols:golf-course",
  "material-symbols:pool",
  "material-symbols:skateboarding",
  "material-symbols:snowboarding",
  "material-symbols:kayaking",
  "material-symbols:surfing",
  "material-symbols:music-note",
  "material-symbols:movie",
  "material-symbols:theaters",
  "material-symbols:casino",
  "material-symbols:celebration",
  "material-symbols:emoji-events",
  "material-symbols:toys",
  "material-symbols:child-friendly",
  "material-symbols:stadia-controller",
  // Home & Services
  "material-symbols:home",
  "material-symbols:apartment",
  "material-symbols:bed",
  "material-symbols:weekend",
  "material-symbols:build",
  "material-symbols:plumbing",
  "material-symbols:electrical-services",
  "material-symbols:cleaning-services",
  "material-symbols:local-laundry-service",
  "material-symbols:hardware",
  "material-symbols:grass",
  "material-symbols:pets",
  "material-symbols:ac-unit",
  "material-symbols:roofing",
  "material-symbols:chair",
  "material-symbols:garage",
  "material-symbols:fence",
  // Tech & Education
  "material-symbols:laptop",
  "material-symbols:phone-iphone",
  "material-symbols:tv",
  "material-symbols:camera-alt",
  "material-symbols:headset",
  "material-symbols:print",
  "material-symbols:school",
  "material-symbols:menu-book",
  "material-symbols:science",
  "material-symbols:computer",
  "material-symbols:devices",
  "material-symbols:router",
  "material-symbols:smart-toy",
  "material-symbols:headphones",
  "material-symbols:monitor",
  "material-symbols:keyboard",
  "material-symbols:tablet",
  "material-symbols:memory",
  // Nature & Weather
  "material-symbols:eco",
  "material-symbols:wb-sunny",
  "material-symbols:thunderstorm",
  "material-symbols:filter-vintage",
  "material-symbols:park",
  "material-symbols:forest",
  "material-symbols:landscape",
  "material-symbols:terrain",
  "material-symbols:volcano",
  "material-symbols:waves",
  "material-symbols:cruelty-free",
  // Animals
  "material-symbols:emoji-nature",
  "material-symbols:bug-report",
  "material-symbols:pest-control",
  // Business & Finance
  "material-symbols:business",
  "material-symbols:account-balance",
  "material-symbols:account-balance-wallet",
  "material-symbols:credit-card",
  "material-symbols:payments",
  "material-symbols:trending-up",
  "material-symbols:work",
  "material-symbols:groups",
  "material-symbols:analytics",
  "material-symbols:attach-money",
  "material-symbols:savings",
  "material-symbols:currency-exchange",
  "material-symbols:point-of-sale",
  // Transport & Logistics
  "material-symbols:local-shipping",
  "material-symbols:local-gas-station",
  "material-symbols:local-parking",
  "material-symbols:local-atm",
  "material-symbols:warehouse",
  "material-symbols:inventory",
  "material-symbols:package",
  "material-symbols:forklift",
  // Communication
  "material-symbols:email",
  "material-symbols:chat",
  "material-symbols:forum",
  "material-symbols:call",
  "material-symbols:contacts",
  "material-symbols:support-agent",
  "material-symbols:contact-support",
  // Icons & Symbols
  "material-symbols:search",
  "material-symbols:favorite",
  "material-symbols:star",
  "material-symbols:thumb-up",
  "material-symbols:bookmark",
  "material-symbols:flag",
  "material-symbols:share",
  "material-symbols:link",
  "material-symbols:category",
  "material-symbols:qr-code",
  "material-symbols:qr-code-scanner",
  "material-symbols:info",
  "material-symbols:help",
  "material-symbols:settings",
  "material-symbols:notifications",
  "material-symbols:event",
  "material-symbols:access-time",
  "material-symbols:lightbulb",
  "material-symbols:extension",
  "material-symbols:security",
  "material-symbols:shield",
  "material-symbols:volunteer-activism",
  "material-symbols:language",
  "material-symbols:public",
  "material-symbols:bolt",
  "material-symbols:whatshot",
  "material-symbols:local-fire-department",
  "material-symbols:solar-power",
  "material-symbols:wind-power",
  "material-symbols:recycling",
  "material-symbols:compost",
  "material-symbols:energy-savings-leaf",
  "material-symbols:diversity-3",
  "material-symbols:elderly-woman",
  "material-symbols:woman",
  "material-symbols:man",
  "material-symbols:child-care",
  "material-symbols:self-improvement",
  "material-symbols:sentiment-satisfied",
  "material-symbols:mood",
  "material-symbols:sick",
  "material-symbols:cookie",
  "material-symbols:hub",
  "material-symbols:card-giftcard",
  "material-symbols:workspace-premium",
  "material-symbols:trophy",
  "material-symbols:military-tech",
];

const DB_PREFIX = "material-symbols:";

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
}

function toIconifyName(dbValue: string): string {
  if (dbValue.startsWith(DB_PREFIX)) return dbValue;
  return `${DB_PREFIX}${dbValue}`;
}

function toDbValue(iconifyName: string): string {
  return iconifyName.replace(DB_PREFIX, "");
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const filtered = search
    ? CATEGORY_ICONS.filter((name) => {
        const short = name.replace(DB_PREFIX, "");
        const q = search.toLowerCase();
        return short.includes(q) || name.includes(q);
      })
    : CATEGORY_ICONS;

  const selectedIconify = value ? toIconifyName(value) : "";

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start gap-2 h-9 font-normal"
        onClick={() => setOpen(!open)}
      >
        {value ? (
          <Icon icon={selectedIconify} width={20} height={20} />
        ) : (
          <span className="text-sm text-muted-foreground">Select an icon…</span>
        )}
      </Button>

      {open && (
        <div className="absolute z-50 mt-1 w-[340px] rounded-lg border bg-popover p-2 shadow-md">
          <div className="relative mb-2">
            <Search className="absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground start-2.5" />
            <Input
              ref={inputRef}
              placeholder="Search icons…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-8 h-8 text-sm"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute top-1/2 -translate-y-1/2 end-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="max-h-[280px] overflow-y-auto overflow-x-hidden">
            <div className="grid grid-cols-8 gap-0.5">
              {filtered.map((name) => {
                const dbVal = toDbValue(name);
                return (
                  <button
                    key={name}
                    type="button"
                    title={dbVal}
                    onClick={() => {
                      onChange(dbVal);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex items-center justify-center rounded-md p-2 transition-colors hover:bg-accent",
                      value === dbVal && "bg-accent ring-1 ring-ring"
                    )}
                  >
                    <Icon icon={name} width={22} height={22} />
                  </button>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-6">
                No icons found
              </p>
            )}
          </div>

          {value && (
            <div className="mt-2 pt-2 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Selected: <code className="text-foreground">{value}</code>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
