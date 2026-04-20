import {
  ChevronDown,
  ChevronRight,
  EyeOff,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { RiRepeatLine } from "react-icons/ri";
import { useEffect, useMemo, useRef, useState } from "react";
import "./NewMonitorPage.css";
import { type MonitorIpVersion } from "../../lib/api";

type MonitorAuthType = "none" | "basic" | "bearer";
type MonitorIpVersionUI =
  | "IPv4 / IPv6 (IPv4 Priority)"
  | "IPv6 / IPv4 (IPv6 Priority)"
  | "IPv4 only"
  | "IPv6 only";
type MonitorUpStatusCodeGroup = "2xx" | "3xx";

// Les libelles UI correspondent exactement aux valeurs acceptees par l'API.
const convertIpVersionToApi = (
  uiVersion: MonitorIpVersionUI,
): MonitorIpVersion => uiVersion;

interface NewMonitorPageProps {
  onBack: () => void;
  onCreateMonitor?: (payload: {
    name: string;
    url: string;
    type: MonitorProtocol;
    interval: number;
    timeout: number;
    ipVersion?: MonitorIpVersion;
    httpMethod:
      | "GET"
      | "POST"
      | "PUT"
      | "PATCH"
      | "DELETE"
      | "HEAD"
      | "OPTIONS";
    emailNotificationsEnabled?: boolean;
    domainExpiryMode?: "enabled" | "disabled";
    sslExpiryMode?: "enabled" | "disabled";
    body?: string;
    headers?: Record<string, string>;
    responseValidation?: {
      field: "status";
      mode: "value" | "type";
      expectedValue?: string;
      expectedType?: "string" | "boolean" | "number";
    };
    followRedirections?: boolean;
    upStatusCodeGroups?: MonitorUpStatusCodeGroup[];
  }) => Promise<string | null>;
  initialName?: string;
  initialUrl?: string;
  initialProtocol?: "http" | "https" | "ws" | "wss";
  initialIntervalSeconds?: number;
  initialTimeoutSeconds?: number;
  initialHttpMethod?:
    | "GET"
    | "POST"
    | "PUT"
    | "PATCH"
    | "DELETE"
    | "HEAD"
    | "OPTIONS";
  initialDomainExpiryMode?: "enabled" | "disabled";
  initialSslExpiryMode?: "enabled" | "disabled";
  initialSslCheckMode?: "enabled" | "disabled";
  initialTagsText?: string;
  initialSlowResponseAlert?: boolean;
  initialSlowResponseThresholdMs?: number;
  initialIpVersion?: MonitorIpVersionUI;
  initialFollowRedirections?: boolean;
  initialAuthType?: MonitorAuthType;
  initialAuthUsername?: string;
  initialAuthPassword?: string;
  initialRequestBody?: string;
  initialSendAsJson?: boolean;
  initialHeaderKey?: string;
  initialHeaderValue?: string;
  initialUpStatusCodeGroups?: MonitorUpStatusCodeGroup[];
  notificationEmail?: string;
}

const intervalOptions = ["30s", "1m", "5m", "30m", "1h", "12h", "12h", "24h"];
const timeoutOptions = ["1s", "15s", "30s", "45s", "60s"];
const httpMethods = [
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];
const ipVersionOptions: MonitorIpVersionUI[] = [
  "IPv4 / IPv6 (IPv4 Priority)",
  "IPv6 / IPv4 (IPv6 Priority)",
  "IPv4 only",
  "IPv6 only",
];
const DEFAULT_REQUEST_BODY_TEMPLATE = '{ "key": "value" }';
const DEFAULT_UP_STATUS_CODE_GROUPS: MonitorUpStatusCodeGroup[] = [
  "2xx",
  "3xx",
];
const createHeaderDraft = (key = "", value = ""): RequestHeaderDraft => ({
  id: `request-header-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  key,
  value,
});

type MonitorProtocol = "http" | "https" | "ws" | "wss";
type MonitorExpiryMode = "enabled" | "disabled";
type NewMonitorSideSection = "details" | "integrations" | "maintenance";
type NotificationChannel = "email" | "sms" | "voice" | "push";
type NotificationRepeat = "none" | "every-check" | "hourly" | "daily";
type NotificationDelay = "none" | "1m" | "5m" | "15m";

interface NotificationTiming {
  repeat: NotificationRepeat;
  delay: NotificationDelay;
}

interface RequestHeaderDraft {
  id: string;
  key: string;
  value: string;
}

type ResponseValidationMode = "value" | "type";
type ResponseValidationType = "string" | "boolean" | "number";

interface ProtocolOption {
  value: MonitorProtocol;
  badge: string;
  title: string;
  description: string;
  placeholder: string;
}

const protocolOptions: ProtocolOption[] = [
  {
    value: "http",
    badge: "HTTP://",
    title: "HTTP / website monitoring",
    description:
      "Use HTTP monitor to monitor your website, API endpoint, or anything running on HTTP.",
    placeholder: "http://",
  },
  {
    value: "https",
    badge: "HTTPS://",
    title: "HTTPS / website monitoring",
    description:
      "Use HTTPS monitor to monitor your secure website, API endpoint, or HTTPS service.",
    placeholder: "https://",
  },
  {
    value: "ws",
    badge: "WS://",
    title: "WS / websocket monitoring",
    description:
      "Use WebSocket monitor to monitor your WS endpoint and real-time socket availability.",
    placeholder: "ws://",
  },
  {
    value: "wss",
    badge: "WSS://",
    title: "WSS / websocket monitoring",
    description:
      "Use secure WebSocket monitor to monitor your WSS endpoint with encrypted transport.",
    placeholder: "wss://",
  },
];

const protocolPrefixes: Record<MonitorProtocol, string> = {
  http: "http://",
  https: "https://",
  ws: "ws://",
  wss: "wss://",
};

const notificationChannelLabels: Record<NotificationChannel, string> = {
  email: "E-mail",
  sms: "SMS message",
  voice: "Voice call",
  push: "Mobile push",
};

const repeatOptionLabels: Record<NotificationRepeat, string> = {
  none: "No repeat",
  "every-check": "Repeat every check",
  hourly: "Repeat hourly",
  daily: "Repeat daily",
};

const delayOptionLabels: Record<NotificationDelay, string> = {
  none: "No delay",
  "1m": "Delay 1 minute",
  "5m": "Delay 5 minutes",
  "15m": "Delay 15 minutes",
};

const phoneCountryOptions = `
United States|+1
United Kingdom|+44
Afghanistan (افغانستان)|+93
Albania (Shqiperi)|+355
Algeria (الجزائر)|+213
American Samoa|+1
Andorra|+376
Angola|+244
Anguilla|+1
Antigua and Barbuda|+1
Argentina|+54
Armenia (Հայաստան)|+374
Aruba|+297
Ascension Island|+247
Australia|+61
Austria (Osterreich)|+43
Azerbaijan (Azarbaycan)|+994
Bahamas|+1
Bahrain (البحرين)|+973
Bangladesh (বাংলাদেশ)|+880
Barbados|+1
Belarus (Беларусь)|+375
Belgium (Belgie)|+32
Belize|+501
Benin (Benin)|+229
Bermuda|+1
Bhutan (འབྲུག)|+975
Bolivia|+591
Bosnia and Herzegovina (Босна и Херцеговина)|+387
Botswana|+267
Brazil (Brasil)|+55
British Indian Ocean Territory|+246
British Virgin Islands|+1
Brunei|+673
Bulgaria (България)|+359
Burkina Faso|+226
Burundi (Uburundi)|+257
Cambodia (កម្ពុជា)|+855
Cameroon (Cameroun)|+237
Canada|+1
Cape Verde (Kabu Verdi)|+238
Caribbean Netherlands|+599
Cayman Islands|+1
Central African Republic (Republique centrafricaine)|+236
Chad (Tchad)|+235
Chile|+56
China (中国)|+86
Christmas Island|+61
Cocos (Keeling) Islands|+61
Colombia|+57
Comoros (جزر القمر)|+269
Congo (DRC) (Jamhuri ya Kidemokrasia ya Kongo)|+243
Congo (Republic) (Congo-Brazzaville)|+242
Cook Islands|+682
Costa Rica|+506
Cote d'Ivoire|+225
Croatia (Hrvatska)|+385
Cuba|+53
Curacao|+599
Cyprus (Κύπρος)|+357
Czech Republic (Ceska republika)|+420
Denmark (Danmark)|+45
Djibouti|+253
Dominica|+1
Dominican Republic (Republica Dominicana)|+1
Ecuador|+593
Egypt (مصر)|+20
El Salvador|+503
Equatorial Guinea (Guinea Ecuatorial)|+240
Eritrea|+291
Estonia (Eesti)|+372
Eswatini|+268
Ethiopia|+251
Falkland Islands (Islas Malvinas)|+500
Faroe Islands (Foroyar)|+298
Fiji|+679
Finland (Suomi)|+358
France|+33
French Guiana (Guyane francaise)|+594
French Polynesia (Polynesie francaise)|+689
Gabon|+241
Gambia|+220
Georgia (საქართველო)|+995
Germany (Deutschland)|+49
Ghana (Gaana)|+233
Gibraltar|+350
Greece (Ελλάδα)|+30
Greenland (Kalaallit Nunaat)|+299
Grenada|+1
Guadeloupe|+590
Guam|+1
Guatemala|+502
Guernsey|+44
Guinea (Guinee)|+224
Guinea-Bissau (Guine Bissau)|+245
Guyana|+592
Haiti|+509
Honduras|+504
Hong Kong (香港)|+852
Hungary (Magyarorszag)|+36
Iceland (Island)|+354
India (भारत)|+91
Indonesia|+62
Iran (ایران)|+98
Iraq (العراق)|+964
Ireland|+353
Isle of Man|+44
Israel (ישראל)|+972
Italy (Italia)|+39
Jamaica|+1
Japan (日本)|+81
Jersey|+44
Jordan (الأردن)|+962
Kazakhstan (Казахстан)|+7
Kenya|+254
Kiribati|+686
Kosovo|+383
Kuwait (الكويت)|+965
Kyrgyzstan (Кыргызстан)|+996
Laos (ລາວ)|+856
Latvia (Latvija)|+371
Lebanon (لبنان)|+961
Lesotho|+266
Liberia|+231
Libya (ليبيا)|+218
Liechtenstein|+423
Lithuania (Lietuva)|+370
Luxembourg|+352
Macau (澳門)|+853
North Macedonia (Македонија)|+389
Madagascar (Madagasikara)|+261
Malawi|+265
Malaysia|+60
Maldives|+960
Mali|+223
Malta|+356
Marshall Islands|+692
Martinique|+596
Mauritania (موريتانيا)|+222
Mauritius (Moris)|+230
Mayotte|+262
Mexico (Mexico)|+52
Micronesia|+691
Moldova (Republica Moldova)|+373
Monaco|+377
Mongolia (Монгол)|+976
Montenegro (Crna Gora)|+382
Montserrat|+1
Morocco (المغرب)|+212
Mozambique (Mocambique)|+258
Myanmar (Burma) (မြန်မာ)|+95
Namibia (Namibie)|+264
Nauru|+674
Nepal (नेपाल)|+977
Netherlands (Nederland)|+31
New Caledonia (Nouvelle-Caledonie)|+687
New Zealand|+64
Nicaragua|+505
Niger (Nijar)|+227
Nigeria|+234
Niue|+683
Norfolk Island|+672
North Korea (조선 민주주의 인민 공화국)|+850
Northern Mariana Islands|+1
Norway (Norge)|+47
Oman (عمان)|+968
Pakistan (پاکستان)|+92
Palau|+680
Palestine (فلسطين)|+970
Panama (Panama)|+507
Papua New Guinea|+675
Paraguay|+595
Peru (Peru)|+51
Philippines|+63
Poland (Polska)|+48
Portugal|+351
Puerto Rico|+1
Qatar (قطر)|+974
Reunion (La Reunion)|+262
Romania (Romania)|+40
Russia (Россия)|+7
Rwanda|+250
Saint Barthelemy|+590
Saint Helena|+290
Saint Kitts and Nevis|+1
Saint Lucia|+1
Saint Martin (French part)|+590
Saint Pierre and Miquelon|+508
Saint Vincent and the Grenadines|+1
Samoa|+685
San Marino|+378
Sao Tome and Principe|+239
Saudi Arabia (المملكة العربية السعودية)|+966
Senegal (Senegal)|+221
Serbia (Србија)|+381
Seychelles|+248
Sierra Leone|+232
Singapore|+65
Sint Maarten|+1
Slovakia (Slovensko)|+421
Slovenia (Slovenija)|+386
Solomon Islands|+677
Somalia (Soomaaliya)|+252
South Africa|+27
South Korea (대한민국)|+82
South Sudan (جنوب السودان)|+211
Spain (Espana)|+34
Sri Lanka (ශ්‍රී ලංකාව)|+94
Sudan (السودان)|+249
Suriname|+597
Svalbard and Jan Mayen|+47
Sweden (Sverige)|+46
Switzerland (Schweiz)|+41
Syria (سوريا)|+963
Taiwan (台灣)|+886
Tajikistan|+992
Tanzania|+255
Thailand (ไทย)|+66
Timor-Leste|+670
Togo|+228
Tokelau|+690
Tonga|+676
Trinidad and Tobago|+1
Tunisia (تونس)|+216
Turkey (Turkiye)|+90
Turkmenistan|+993
Turks and Caicos Islands|+1
Tuvalu|+688
U.S. Virgin Islands|+1
Uganda|+256
Ukraine (Україна)|+380
United Arab Emirates (الإمارات العربية المتحدة)|+971
Uruguay|+598
Uzbekistan (Ozbekiston)|+998
Vanuatu|+678
Vatican City (Citta del Vaticano)|+39
Venezuela|+58
Vietnam (Viet Nam)|+84
Wallis and Futuna|+681
Western Sahara (الصحراء الغربية)|+212
Yemen (اليمن)|+967
Zambia|+260
Zimbabwe|+263
Aland Islands|+358
`
  .trim()
  .split("\n")
  .map((entry, index) => {
    const [labelPart, dialCodePart] = entry.split("|");
    return {
      id: `phone-country-${index}`,
      label: (labelPart ?? "").trim(),
      dialCode: (dialCodePart ?? "").trim(),
    };
  })
  .filter((country) => country.label !== "" && country.dialCode !== "");

const DEFAULT_PHONE_DIAL_CODE = "+216";
const defaultPhoneCountryOption =
  phoneCountryOptions.find(
    (country) =>
      country.label.startsWith("Tunisia") &&
      country.dialCode === DEFAULT_PHONE_DIAL_CODE,
  ) ?? phoneCountryOptions[0];

const phoneCountryStopWords = new Set(["and", "of", "the"]);

const getPhoneCountryAbbreviation = (label: string): string => {
  const baseLabel = label.split("(")[0]?.trim() ?? label.trim();
  const normalizedLabel = baseLabel.replace(/[.'’]/g, "").replace(/-/g, " ");
  const words = normalizedLabel.split(/\s+/).filter((word) => word !== "");

  if (words.length === 0) {
    return "--";
  }

  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }

  const significantWords = words.filter(
    (word) => !phoneCountryStopWords.has(word.toLowerCase()),
  );
  const sourceWords = significantWords.length >= 2 ? significantWords : words;

  if (
    sourceWords[0].length === 2 &&
    sourceWords[0] === sourceWords[0].toUpperCase()
  ) {
    return sourceWords[0];
  }

  return `${sourceWords[0].charAt(0)}${sourceWords[1].charAt(0)}`.toUpperCase();
};

interface PhoneValidationResult {
  error: string | null;
  isValid: boolean;
  normalizedPhone: string;
}

const parseIntervalToMinutes = (label: string): number => {
  const numericValue = Number.parseInt(label, 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 5;

  if (label.endsWith("s")) {
    return Math.max(1, Math.ceil(numericValue / 60));
  }

  if (label.endsWith("h")) {
    return numericValue * 60;
  }

  return numericValue;
};

const parseIntervalToSeconds = (label: string): number => {
  const numericValue = Number.parseInt(label, 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 5 * 60;

  if (label.endsWith("s")) {
    return numericValue;
  }

  if (label.endsWith("h")) {
    return numericValue * 60 * 60;
  }

  return numericValue * 60;
};

const parseTimeoutToSeconds = (label: string): number => {
  const numericValue = Number.parseInt(label, 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 30;
  return numericValue;
};

const findClosestOptionIndex = (
  options: string[],
  targetValue: number | undefined,
  parser: (label: string) => number,
  fallbackIndex: number,
): number => {
  if (!Number.isFinite(targetValue)) {
    return fallbackIndex;
  }

  let bestIndex = fallbackIndex;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const [index, option] of options.entries()) {
    const distance = Math.abs(parser(option) - Number(targetValue));
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }

  return bestIndex;
};

const mapHttpMethod = (
  method: string,
): "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS" => {
  if (
    method === "GET" ||
    method === "POST" ||
    method === "PUT" ||
    method === "PATCH" ||
    method === "DELETE" ||
    method === "HEAD" ||
    method === "OPTIONS"
  ) {
    return method;
  }

  return "GET";
};

const normalizeIpVersionOption = (value?: string): MonitorIpVersionUI =>
  ipVersionOptions.find((option) => option === value) ?? ipVersionOptions[0];

const hasInitialAdvancedPrefill = (input: {
  timeoutSeconds?: number;
  slowResponseAlert?: boolean;
  slowResponseThresholdMs?: number;
  ipVersion?: MonitorIpVersionUI;
  followRedirections?: boolean;
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
  authType?: MonitorAuthType;
  authUsername?: string;
  authPassword?: string;
  requestBody?: string;
  sendAsJson?: boolean;
  headerKey?: string;
  headerValue?: string;
  upStatusCodeGroups?: MonitorUpStatusCodeGroup[];
}): boolean =>
  Boolean(
    input.timeoutSeconds !== undefined ||
    input.slowResponseAlert ||
    input.slowResponseThresholdMs !== undefined ||
    (input.ipVersion && input.ipVersion !== ipVersionOptions[0]) ||
    input.followRedirections === false ||
    (input.httpMethod && input.httpMethod !== "GET") ||
    (input.authType && input.authType !== "none") ||
    input.authUsername ||
    input.authPassword ||
    input.requestBody ||
    input.sendAsJson ||
    input.headerKey ||
    input.headerValue ||
    (input.upStatusCodeGroups &&
      (input.upStatusCodeGroups.length !==
        DEFAULT_UP_STATUS_CODE_GROUPS.length ||
        input.upStatusCodeGroups.some(
          (group, index) => group !== DEFAULT_UP_STATUS_CODE_GROUPS[index],
        ))),
  );

const encodeBase64 = (value: string): string => {
  if (typeof window !== "undefined" && typeof window.btoa === "function") {
    return window.btoa(value);
  }

  return btoa(value);
};

function NewMonitorPage({
  onBack,
  onCreateMonitor,
  initialName,
  initialUrl,
  initialProtocol,
  initialIntervalSeconds,
  initialTimeoutSeconds,
  initialHttpMethod,
  initialDomainExpiryMode,
  initialSslExpiryMode,
  initialSslCheckMode,
  initialTagsText,
  initialSlowResponseAlert,
  initialSlowResponseThresholdMs,
  initialIpVersion,
  initialFollowRedirections,
  initialAuthType,
  initialAuthUsername,
  initialAuthPassword,
  initialRequestBody,
  initialSendAsJson,
  initialHeaderKey,
  initialHeaderValue,
  initialUpStatusCodeGroups,
  notificationEmail,
}: NewMonitorPageProps) {
  const initialMonitorUrl =
    initialUrl ?? protocolPrefixes[initialProtocol ?? "https"];
  const [selectedIntervalIndex, setSelectedIntervalIndex] = useState(() =>
    findClosestOptionIndex(
      intervalOptions,
      initialIntervalSeconds,
      parseIntervalToSeconds,
      2,
    ),
  );
  const [selectedTimeoutIndex, setSelectedTimeoutIndex] = useState(() =>
    findClosestOptionIndex(
      timeoutOptions,
      initialTimeoutSeconds,
      parseTimeoutToSeconds,
      2,
    ),
  );
  const [selectedProtocol, setSelectedProtocol] = useState<MonitorProtocol>(
    initialProtocol ?? "https",
  );
  const [monitorName, setMonitorName] = useState(initialName ?? "");
  const [monitorUrl, setMonitorUrl] = useState(initialMonitorUrl);
  const [isProtocolMenuOpen, setIsProtocolMenuOpen] = useState(false);
  const [isSslDomainOpen, setIsSslDomainOpen] = useState(
    () =>
      initialSslCheckMode === "enabled" ||
      initialSslExpiryMode === "enabled" ||
      initialDomainExpiryMode === "enabled",
  );
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(() =>
    hasInitialAdvancedPrefill({
      timeoutSeconds: initialTimeoutSeconds,
      slowResponseAlert: initialSlowResponseAlert,
      slowResponseThresholdMs: initialSlowResponseThresholdMs,
      ipVersion: initialIpVersion,
      followRedirections: initialFollowRedirections,
      httpMethod: initialHttpMethod,
      authType: initialAuthType,
      authUsername: initialAuthUsername,
      authPassword: initialAuthPassword,
      requestBody: initialRequestBody,
      sendAsJson: initialSendAsJson,
      headerKey: initialHeaderKey,
      headerValue: initialHeaderValue,
      upStatusCodeGroups: initialUpStatusCodeGroups,
    }),
  );
  const [sslCheckMode, setSslCheckMode] = useState<MonitorExpiryMode>(
    initialSslCheckMode ?? "disabled",
  );
  const [sslExpiryMode, setSslExpiryMode] = useState<MonitorExpiryMode>(
    initialSslExpiryMode ?? "disabled",
  );
  const [domainExpiryMode, setDomainExpiryMode] = useState<MonitorExpiryMode>(
    initialDomainExpiryMode ?? "disabled",
  );
  const [slowResponseAlert, setSlowResponseAlert] = useState(
    Boolean(
      initialSlowResponseAlert ?? initialSlowResponseThresholdMs !== undefined,
    ),
  );
  const [slowResponseThreshold, setSlowResponseThreshold] = useState(
    initialSlowResponseThresholdMs !== undefined
      ? String(initialSlowResponseThresholdMs)
      : "1000",
  );
  const [selectedIpVersion, setSelectedIpVersion] =
    useState<MonitorIpVersionUI>(() =>
      normalizeIpVersionOption(initialIpVersion),
    );
  const [followRedirections, setFollowRedirections] = useState(
    initialFollowRedirections ?? true,
  );
  const [selectedHttpMethod, setSelectedHttpMethod] = useState<string>(
    initialHttpMethod ?? "GET",
  );
  const [sendAsJson, setSendAsJson] = useState(initialSendAsJson ?? false);
  const [authType, setAuthType] = useState<MonitorAuthType>(
    initialAuthType ?? "none",
  );
  const [authUsername, setAuthUsername] = useState(initialAuthUsername ?? "");
  const [authPassword, setAuthPassword] = useState(initialAuthPassword ?? "");
  const [requestBody, setRequestBody] = useState(
    initialRequestBody ?? DEFAULT_REQUEST_BODY_TEMPLATE,
  );
  const [requestHeaders, setRequestHeaders] = useState<RequestHeaderDraft[]>(
    () => [createHeaderDraft(initialHeaderKey ?? "", initialHeaderValue ?? "")],
  );
  const [isResponseValidationEnabled, setIsResponseValidationEnabled] =
    useState(false);
  const [responseValidationMode, setResponseValidationMode] =
    useState<ResponseValidationMode>("value");
  const [responseValidationValue, setResponseValidationValue] = useState("up");
  const [responseValidationType, setResponseValidationType] =
    useState<ResponseValidationType>("string");
  const [selectedUpStatusCodeGroups, setSelectedUpStatusCodeGroups] = useState<
    MonitorUpStatusCodeGroup[]
  >(
    initialUpStatusCodeGroups && initialUpStatusCodeGroups.length > 0
      ? initialUpStatusCodeGroups
      : DEFAULT_UP_STATUS_CODE_GROUPS,
  );
  const [tagsText, setTagsText] = useState(initialTagsText ?? "");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [activeSideSection, setActiveSideSection] =
    useState<NewMonitorSideSection>("details");
  const [enabledNotificationChannels, setEnabledNotificationChannels] =
    useState<Record<NotificationChannel, boolean>>({
      email: true,
      sms: false,
      voice: false,
      push: false,
    });
  const [notificationPhoneNumber, setNotificationPhoneNumber] = useState("");
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [phoneModalChannel, setPhoneModalChannel] = useState<"sms" | "voice">(
    "sms",
  );
  const [phoneCountryIdDraft, setPhoneCountryIdDraft] = useState(
    defaultPhoneCountryOption?.id ?? "",
  );
  const [isPhoneCountryMenuOpen, setIsPhoneCountryMenuOpen] = useState(false);
  const [phoneCountrySearchQuery, setPhoneCountrySearchQuery] = useState("");
  const [phoneLocalNumberDraft, setPhoneLocalNumberDraft] = useState("");
  const [phoneDraftError, setPhoneDraftError] = useState<string | null>(null);
  const [notificationTimings, setNotificationTimings] = useState<
    Record<NotificationChannel, NotificationTiming>
  >({
    email: { repeat: "none", delay: "none" },
    sms: { repeat: "none", delay: "none" },
    voice: { repeat: "none", delay: "none" },
    push: { repeat: "none", delay: "none" },
  });
  const [isTimingModalOpen, setIsTimingModalOpen] = useState(false);
  const [timingModalChannel, setTimingModalChannel] =
    useState<NotificationChannel>("email");
  const [timingRepeatDraft, setTimingRepeatDraft] =
    useState<NotificationRepeat>("none");
  const [timingDelayDraft, setTimingDelayDraft] =
    useState<NotificationDelay>("none");
  const protocolMenuRef = useRef<HTMLDivElement | null>(null);
  const phoneCountryMenuRef = useRef<HTMLDivElement | null>(null);
  const detailsSectionRef = useRef<HTMLElement | null>(null);
  const integrationsSectionRef = useRef<HTMLElement | null>(null);
  const maintenanceSectionRef = useRef<HTMLElement | null>(null);
  const resolvedNotificationEmail =
    (notificationEmail ?? "").trim() || "No email connected";
  const selectedIntervalLabel = useMemo(
    () => intervalOptions[selectedIntervalIndex] ?? intervalOptions[2],
    [selectedIntervalIndex],
  );
  const selectedProtocolOption = useMemo(
    () =>
      protocolOptions.find((option) => option.value === selectedProtocol) ??
      protocolOptions[0],
    [selectedProtocol],
  );
  const intervalProgress = useMemo(() => {
    if (intervalOptions.length <= 1) return 0;
    return (selectedIntervalIndex / (intervalOptions.length - 1)) * 100;
  }, [selectedIntervalIndex]);
  const timeoutProgress = useMemo(() => {
    if (timeoutOptions.length <= 1) return 0;
    return (selectedTimeoutIndex / (timeoutOptions.length - 1)) * 100;
  }, [selectedTimeoutIndex]);
  const selectedPhoneCountryOption = useMemo(
    () =>
      phoneCountryOptions.find(
        (country) => country.id === phoneCountryIdDraft,
      ) ??
      defaultPhoneCountryOption ??
      phoneCountryOptions[0],
    [phoneCountryIdDraft],
  );
  const filteredPhoneCountryOptions = useMemo(() => {
    const normalizedQuery = phoneCountrySearchQuery.trim().toLowerCase();
    if (normalizedQuery === "") {
      return phoneCountryOptions;
    }

    return phoneCountryOptions.filter((country) => {
      const normalizedLabel = country.label.toLowerCase();
      const normalizedDialCode = country.dialCode.toLowerCase();
      return (
        normalizedLabel.includes(normalizedQuery) ||
        normalizedDialCode.includes(normalizedQuery)
      );
    });
  }, [phoneCountrySearchQuery]);

  const toggleProtocolMenu = () => {
    setIsProtocolMenuOpen((prev) => !prev);
  };

  const toggleUpStatusCodeGroup = (group: MonitorUpStatusCodeGroup) => {
    setSelectedUpStatusCodeGroups((current) =>
      current.includes(group)
        ? current.length === 1
          ? current
          : current.filter((candidate) => candidate !== group)
        : [...current, group],
    );
  };

  const updateUrlForProtocol = (nextProtocol: MonitorProtocol) => {
    const nextPrefix = protocolPrefixes[nextProtocol];
    setMonitorUrl((previous) => {
      const trimmed = previous.trim();
      if (trimmed === "") {
        return nextPrefix;
      }
      const allPrefixes = Object.values(protocolPrefixes);
      if (allPrefixes.includes(trimmed)) {
        return nextPrefix;
      }
      for (const prefix of allPrefixes) {
        if (trimmed.startsWith(prefix)) {
          return `${nextPrefix}${trimmed.slice(prefix.length)}`;
        }
      }
      return previous;
    });
  };

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        protocolMenuRef.current &&
        !protocolMenuRef.current.contains(target)
      ) {
        setIsProtocolMenuOpen(false);
      }

      if (
        phoneCountryMenuRef.current &&
        !phoneCountryMenuRef.current.contains(target)
      ) {
        setIsPhoneCountryMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  useEffect(() => {
    if (!isPhoneCountryMenuOpen) {
      setPhoneCountrySearchQuery("");
    }
  }, [isPhoneCountryMenuOpen]);

  const isCreateDisabled =
    monitorName.trim() === "" || monitorUrl.trim() === "" || isCreating;

  const handleCreateMonitor = async () => {
    if (isCreateDisabled || !onCreateMonitor) return;

    setCreateError(null);
    setIsCreating(true);

    const selectedInterval =
      intervalOptions[selectedIntervalIndex] ?? intervalOptions[2];
    const selectedTimeout =
      timeoutOptions[selectedTimeoutIndex] ?? timeoutOptions[2];
    const httpMethod = mapHttpMethod(selectedHttpMethod);
    const resolvedHeaders: Record<string, string> = {};
    const cleanedUsername = authUsername.trim();
    const cleanedPassword = authPassword.trim();
    const cleanedRequestBody = requestBody.trim();

    for (const header of requestHeaders) {
      const cleanedHeaderKey = header.key.trim();
      if (cleanedHeaderKey === "") {
        continue;
      }

      resolvedHeaders[cleanedHeaderKey] = header.value.trim();
    }

    if (
      authType === "basic" &&
      (cleanedUsername !== "" || cleanedPassword !== "")
    ) {
      resolvedHeaders.Authorization = `Basic ${encodeBase64(`${cleanedUsername}:${cleanedPassword}`)}`;
    }

    if (authType === "bearer") {
      const token = cleanedPassword !== "" ? cleanedPassword : cleanedUsername;
      if (token !== "") {
        resolvedHeaders.Authorization = `Bearer ${token}`;
      }
    }

    const shouldSendBody =
      (httpMethod === "POST" ||
        httpMethod === "PUT" ||
        httpMethod === "PATCH") &&
      cleanedRequestBody !== "" &&
      (cleanedRequestBody !== DEFAULT_REQUEST_BODY_TEMPLATE ||
        initialRequestBody !== undefined);

    // Only add Content-Type header when a body will actually be sent.
    if (
      shouldSendBody &&
      sendAsJson &&
      !Object.keys(resolvedHeaders).some(
        (key) => key.toLowerCase() === "content-type",
      )
    ) {
      resolvedHeaders["Content-Type"] = "application/json";
    }

    const responseValidation = isResponseValidationEnabled
      ? {
          field: "status" as const,
          mode: responseValidationMode,
          expectedValue:
            responseValidationMode === "value"
              ? responseValidationValue.trim()
              : undefined,
          expectedType:
            responseValidationMode === "type"
              ? responseValidationType
              : undefined,
        }
      : undefined;

    const error = await onCreateMonitor({
      name: monitorName.trim(),
      url: monitorUrl.trim(),
      type: selectedProtocol,
      interval: parseIntervalToMinutes(selectedInterval),
      timeout: parseTimeoutToSeconds(selectedTimeout),
      ipVersion: selectedIpVersion
        ? convertIpVersionToApi(selectedIpVersion)
        : undefined,
      httpMethod,
      emailNotificationsEnabled: enabledNotificationChannels.email,
      domainExpiryMode: domainExpiryMode === "enabled" ? "enabled" : "disabled",
      sslExpiryMode: sslExpiryMode === "enabled" ? "enabled" : "disabled",
      followRedirections,
      body: shouldSendBody ? cleanedRequestBody : undefined,
      headers:
        Object.keys(resolvedHeaders).length > 0 ? resolvedHeaders : undefined,
      responseValidation,
      upStatusCodeGroups: [...selectedUpStatusCodeGroups],
    });

    if (error) {
      setCreateError(error);
      setIsCreating(false);
      return;
    }

    setIsCreating(false);
    setCreateError(null);
  };

  const scrollToSection = (section: NewMonitorSideSection) => {
    setActiveSideSection(section);
    const target =
      section === "details"
        ? detailsSectionRef.current
        : section === "integrations"
          ? integrationsSectionRef.current
          : maintenanceSectionRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const normalizePhoneNumber = (value: string): string =>
    value.replace(/\s+/g, " ").trim();

  const extractPhoneDigits = (value: string): string =>
    value.replace(/\D/g, "");

  const normalizeDialCode = (value: string): string => {
    const dialDigits = extractPhoneDigits(value);
    return dialDigits === "" ? DEFAULT_PHONE_DIAL_CODE : `+${dialDigits}`;
  };

  const validatePhoneNumberDraft = (
    countryCode: string,
    localNumber: string,
  ): PhoneValidationResult => {
    const normalizedCountryCode = normalizeDialCode(countryCode);
    const normalizedLocalNumber = normalizePhoneNumber(localNumber);

    if (normalizedLocalNumber === "") {
      return {
        isValid: false,
        error: "Phone number is required.",
        normalizedPhone: "",
      };
    }

    if (!/^[0-9\s\-()]+$/.test(normalizedLocalNumber)) {
      return {
        isValid: false,
        error: 'Use digits only (spaces, "-" and parentheses are allowed).',
        normalizedPhone: "",
      };
    }

    const dialDigits = extractPhoneDigits(normalizedCountryCode);
    const localDigits = extractPhoneDigits(normalizedLocalNumber);

    if (localDigits.length < 6 || localDigits.length > 14) {
      return {
        isValid: false,
        error: "Phone number must contain between 6 and 14 digits.",
        normalizedPhone: "",
      };
    }

    if (/^0+$/.test(localDigits)) {
      return {
        isValid: false,
        error: "Phone number is invalid.",
        normalizedPhone: "",
      };
    }

    const totalDigits = dialDigits.length + localDigits.length;
    if (totalDigits < 8 || totalDigits > 15) {
      return {
        isValid: false,
        error: "Phone number must match international format.",
        normalizedPhone: "",
      };
    }

    return {
      isValid: true,
      error: null,
      normalizedPhone: `${normalizedCountryCode} ${localDigits}`,
    };
  };

  const splitPhoneNumber = (
    value: string,
  ): { countryCode: string; localNumber: string } => {
    const normalizedPhone = normalizePhoneNumber(value);
    if (normalizedPhone === "") {
      return { countryCode: DEFAULT_PHONE_DIAL_CODE, localNumber: "" };
    }

    const parsed = normalizedPhone.match(/^(\+\d{1,4})(?:\s+)?(.*)$/);
    if (!parsed) {
      return {
        countryCode: DEFAULT_PHONE_DIAL_CODE,
        localNumber: normalizedPhone,
      };
    }

    return {
      countryCode: parsed[1],
      localNumber: parsed[2] ?? "",
    };
  };

  const openPhoneModal = (
    channel: "sms" | "voice",
    presetError: string | null = null,
  ) => {
    const parsedPhone = splitPhoneNumber(notificationPhoneNumber);
    const matchedCountry = phoneCountryOptions.find(
      (country) => country.dialCode === parsedPhone.countryCode,
    );
    setPhoneModalChannel(channel);
    setPhoneCountryIdDraft(
      matchedCountry?.id ?? defaultPhoneCountryOption?.id ?? "",
    );
    setIsPhoneCountryMenuOpen(false);
    setPhoneLocalNumberDraft(parsedPhone.localNumber);
    setPhoneDraftError(presetError);
    setIsPhoneModalOpen(true);
  };

  const closePhoneModal = () => {
    setIsPhoneModalOpen(false);
    setIsPhoneCountryMenuOpen(false);
    setPhoneDraftError(null);
  };

  const savePhoneNumber = () => {
    const selectedCountryOption =
      phoneCountryOptions.find(
        (country) => country.id === phoneCountryIdDraft,
      ) ?? defaultPhoneCountryOption;
    const validation = validatePhoneNumberDraft(
      selectedCountryOption?.dialCode ?? DEFAULT_PHONE_DIAL_CODE,
      phoneLocalNumberDraft,
    );

    if (!validation.isValid) {
      setPhoneDraftError(validation.error ?? "Phone number is invalid.");
      return;
    }

    setNotificationPhoneNumber(validation.normalizedPhone);
    setEnabledNotificationChannels((previous) => ({
      ...previous,
      [phoneModalChannel]: true,
    }));
    setIsPhoneModalOpen(false);
    setIsPhoneCountryMenuOpen(false);
    setPhoneDraftError(null);
  };

  const openTimingModal = (channel: NotificationChannel) => {
    const currentTiming = notificationTimings[channel];
    setTimingModalChannel(channel);
    setTimingRepeatDraft(currentTiming.repeat);
    setTimingDelayDraft(currentTiming.delay);
    setIsTimingModalOpen(true);
  };

  const closeTimingModal = () => {
    setIsTimingModalOpen(false);
  };

  const saveTimingSettings = () => {
    setNotificationTimings((previous) => ({
      ...previous,
      [timingModalChannel]: {
        repeat: timingRepeatDraft,
        delay: timingDelayDraft,
      },
    }));
    setIsTimingModalOpen(false);
  };

  const handleToggleNotificationChannel = (channel: NotificationChannel) => {
    const isChannelEnabled = enabledNotificationChannels[channel];
    const requiresPhoneNumber = channel === "sms" || channel === "voice";

    if (!isChannelEnabled && requiresPhoneNumber) {
      if (notificationPhoneNumber.trim() === "") {
        openPhoneModal(channel);
        return;
      }

      const parsedPhone = splitPhoneNumber(notificationPhoneNumber);
      const validation = validatePhoneNumberDraft(
        parsedPhone.countryCode,
        parsedPhone.localNumber,
      );
      if (!validation.isValid) {
        openPhoneModal(channel, validation.error);
        return;
      }
    }

    setEnabledNotificationChannels((previous) => ({
      ...previous,
      [channel]: !previous[channel],
    }));
  };

  const formatNotificationTiming = (timing: NotificationTiming): string => {
    const delayLabel = delayOptionLabels[timing.delay];
    const repeatLabel = repeatOptionLabels[timing.repeat];

    if (timing.delay === "none" && timing.repeat === "none") {
      return "No delay, no repeat";
    }

    return `${delayLabel}, ${repeatLabel.toLowerCase()}`;
  };

  const timingPreview = `${notificationChannelLabels[timingModalChannel]} alerts will use ${delayOptionLabels[timingDelayDraft]} and ${repeatOptionLabels[timingRepeatDraft].toLowerCase()}.`;
  const methodsWithBody = new Set(["POST", "PUT", "PATCH"]);
  const isBodySupportedForSelectedMethod =
    methodsWithBody.has(selectedHttpMethod);

  const updateRequestHeader = (
    id: string,
    field: "key" | "value",
    value: string,
  ): void => {
    setRequestHeaders((currentHeaders) =>
      currentHeaders.map((header) =>
        header.id === id ? { ...header, [field]: value } : header,
      ),
    );
  };

  const addRequestHeader = (): void => {
    setRequestHeaders((currentHeaders) => [
      ...currentHeaders,
      createHeaderDraft(),
    ]);
  };

  const removeRequestHeader = (id: string): void => {
    setRequestHeaders((currentHeaders) => {
      const nextHeaders = currentHeaders.filter((header) => header.id !== id);
      return nextHeaders.length > 0 ? nextHeaders : [createHeaderDraft()];
    });
  };

  return (
    <section className="new-monitor-page">
      <div className="new-monitor-breadcrumb">
        <button
          type="button"
          className="new-monitor-breadcrumb-link"
          onClick={onBack}
        >
          Monitoring
        </button>
        <ChevronRight size={14} />
        <span>Monitoring</span>
      </div>

      <div className="new-monitor-content-grid">
        <div className="new-monitor-main">
          <section className="new-monitor-card" ref={detailsSectionRef}>
            <div className="new-monitor-type-picker" ref={protocolMenuRef}>
              <div
                className="new-monitor-type-selector"
                role="button"
                tabIndex={0}
                aria-haspopup="listbox"
                aria-expanded={isProtocolMenuOpen}
                onClick={toggleProtocolMenu}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleProtocolMenu();
                  }
                }}
              >
                <div className="new-monitor-type-badge">
                  {selectedProtocolOption.badge}
                </div>
                <div className="new-monitor-type-copy">
                  <h2>{selectedProtocolOption.title}</h2>
                  <p>{selectedProtocolOption.description}</p>
                </div>
                <div className="new-monitor-type-toggle">
                  <button
                    id="new-monitor-protocol"
                    className="new-monitor-type-toggle-button"
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isProtocolMenuOpen}
                    aria-label="Select monitor protocol"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleProtocolMenu();
                    }}
                  >
                    <ChevronDown
                      size={16}
                      className={isProtocolMenuOpen ? "open" : ""}
                    />
                  </button>
                </div>
              </div>
              {isProtocolMenuOpen && (
                <div
                  className="new-monitor-type-panel"
                  role="listbox"
                  aria-label="Monitor protocol"
                >
                  {protocolOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selectedProtocol === option.value}
                      className={`new-monitor-type-option ${selectedProtocol === option.value ? "active" : ""}`}
                      onClick={() => {
                        setSelectedProtocol(option.value);
                        updateUrlForProtocol(option.value);
                        setIsProtocolMenuOpen(false);
                      }}
                    >
                      <span className="new-monitor-type-option-badge">
                        {option.badge}
                      </span>
                      <span className="new-monitor-type-option-copy">
                        <strong>{option.title}</strong>
                        <span>{option.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="new-monitor-separator" />

            <div className="new-monitor-field">
              <label htmlFor="new-monitor-name">Monitor name</label>
              <input
                id="new-monitor-name"
                className="new-monitor-input"
                type="text"
                placeholder="My service"
                value={monitorName}
                onChange={(event) => setMonitorName(event.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="new-monitor-separator" />

            <div className="new-monitor-field">
              <label htmlFor="new-monitor-url">URL to monitor</label>
              <input
                id="new-monitor-url"
                className="new-monitor-input"
                type="url"
                placeholder={selectedProtocolOption.placeholder}
                value={monitorUrl}
                onChange={(event) => setMonitorUrl(event.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="new-monitor-separator" />

            <section
              className="new-monitor-notify"
              ref={integrationsSectionRef}
            >
              <h3>How will we notify you ?</h3>
              <div className="new-monitor-notify-grid">
                <article className="notify-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={enabledNotificationChannels.email}
                      onChange={() => handleToggleNotificationChannel("email")}
                    />
                    <span>E-mail</span>
                  </label>
                  <p className="notify-option-value">
                    {resolvedNotificationEmail}
                  </p>
                  <button
                    type="button"
                    className="notify-option-meta notify-option-meta-button"
                    onClick={() => openTimingModal("email")}
                  >
                    <span
                      className="notify-repeat-icon-wrap"
                      aria-hidden="true"
                    >
                      <RiRepeatLine className="notify-repeat-icon" />
                    </span>
                    <span>
                      {formatNotificationTiming(notificationTimings.email)}
                    </span>
                  </button>
                </article>
                <article className="notify-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={enabledNotificationChannels.sms}
                      onChange={() => handleToggleNotificationChannel("sms")}
                    />
                    <span>SMS message</span>
                  </label>
                  {notificationPhoneNumber.trim() === "" ? (
                    <button
                      type="button"
                      className="notify-phone-action"
                      onClick={() => openPhoneModal("sms")}
                    >
                      Add phone number
                    </button>
                  ) : (
                    <p className="notify-option-value">
                      {notificationPhoneNumber}
                    </p>
                  )}
                  <button
                    type="button"
                    className="notify-option-meta notify-option-meta-button"
                    onClick={() => openTimingModal("sms")}
                  >
                    <span
                      className="notify-repeat-icon-wrap"
                      aria-hidden="true"
                    >
                      <RiRepeatLine className="notify-repeat-icon" />
                    </span>
                    <span>
                      {formatNotificationTiming(notificationTimings.sms)}
                    </span>
                  </button>
                </article>
                <article className="notify-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={enabledNotificationChannels.voice}
                      onChange={() => handleToggleNotificationChannel("voice")}
                    />
                    <span>Voice call</span>
                  </label>
                  {notificationPhoneNumber.trim() === "" ? (
                    <button
                      type="button"
                      className="notify-phone-action"
                      onClick={() => openPhoneModal("voice")}
                    >
                      Add phone number
                    </button>
                  ) : (
                    <p className="notify-option-value">
                      {notificationPhoneNumber}
                    </p>
                  )}
                  <button
                    type="button"
                    className="notify-option-meta notify-option-meta-button"
                    onClick={() => openTimingModal("voice")}
                  >
                    <span
                      className="notify-repeat-icon-wrap"
                      aria-hidden="true"
                    >
                      <RiRepeatLine className="notify-repeat-icon" />
                    </span>
                    <span>
                      {formatNotificationTiming(notificationTimings.voice)}
                    </span>
                  </button>
                </article>
                <article className="notify-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={enabledNotificationChannels.push}
                      onChange={() => handleToggleNotificationChannel("push")}
                    />
                    <span>Mobile push</span>
                  </label>
                  <p className="notify-option-value">
                    Download app for{" "}
                    <a
                      className="notify-inline-link"
                      href="https://apps.apple.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      iOS
                    </a>{" "}
                    or{" "}
                    <a
                      className="notify-inline-link"
                      href="https://play.google.com/store"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Android
                    </a>
                  </p>
                  <button
                    type="button"
                    className="notify-option-meta notify-option-meta-button"
                    onClick={() => openTimingModal("push")}
                  >
                    <span
                      className="notify-repeat-icon-wrap"
                      aria-hidden="true"
                    >
                      <RiRepeatLine className="notify-repeat-icon" />
                    </span>
                    <span>
                      {formatNotificationTiming(notificationTimings.push)}
                    </span>
                  </button>
                </article>
              </div>
              <p className="notify-option-footnote">
                You can set up notifications for{" "}
                <button
                  type="button"
                  className="notify-inline-action"
                  onClick={() => {
                    scrollToSection("integrations");
                  }}
                >
                  Integrations & Team
                </button>{" "}
                in the specific tab and edit it later
              </p>
            </section>
          </section>

          <section className="new-monitor-card" ref={maintenanceSectionRef}>
            <h3>Monitor interval</h3>
            <p className="monitor-interval-description">
              Your monitor will be checked every{" "}
              <strong>{selectedIntervalLabel}</strong>. We recommend to use at
              least 1-minute checks
            </p>

            <div className="monitor-interval-slider-wrap">
              <input
                className="monitor-interval-slider"
                type="range"
                min={0}
                max={intervalOptions.length - 1}
                step={1}
                value={selectedIntervalIndex}
                onChange={(event) =>
                  setSelectedIntervalIndex(Number(event.target.value))
                }
                style={{
                  ["--range-progress" as string]: `${intervalProgress}%`,
                }}
              />
              <div className="monitor-interval-labels" aria-hidden="true">
                {intervalOptions.map((option, index) => (
                  <span key={`${option}-${index}`}>{option}</span>
                ))}
              </div>
            </div>

            <section className="ssl-domain-panel">
              <div
                className={`ssl-domain-header ${isSslDomainOpen ? "open" : "closed"}`}
              >
                <button
                  type="button"
                  className="ssl-domain-toggle"
                  onClick={() => setIsSslDomainOpen((prev) => !prev)}
                >
                  <ChevronDown
                    size={15}
                    className={`ssl-domain-toggle-icon ${isSslDomainOpen ? "open" : "closed"}`}
                  />
                  <span>SSL certificate and domain checks</span>
                </button>
              </div>

              {isSslDomainOpen && (
                <div className="ssl-domain-options">
                  <div className="ssl-select-item">
                    <label
                      htmlFor="ssl-check-mode"
                      className="ssl-select-label"
                    >
                      Check ssl errors
                    </label>
                    <div className="ssl-select-wrap">
                      <select
                        id="ssl-check-mode"
                        className="ssl-select"
                        value={sslCheckMode}
                        onChange={(event) =>
                          setSslCheckMode(
                            event.target.value === "enabled"
                              ? "enabled"
                              : "disabled",
                          )
                        }
                      >
                        <option value="disabled">Disabled</option>
                        <option value="enabled">Enabled</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>

                  <div className="ssl-select-item">
                    <label
                      htmlFor="ssl-expiry-mode"
                      className="ssl-select-label"
                    >
                      SSL expiry reminders
                    </label>
                    <div className="ssl-select-wrap">
                      <select
                        id="ssl-expiry-mode"
                        className="ssl-select"
                        value={sslExpiryMode}
                        onChange={(event) =>
                          setSslExpiryMode(
                            event.target.value === "enabled"
                              ? "enabled"
                              : "disabled",
                          )
                        }
                      >
                        <option value="disabled">Disabled</option>
                        <option value="enabled">Enabled</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>

                  <div className="ssl-select-item">
                    <label
                      htmlFor="domain-expiry-mode"
                      className="ssl-select-label"
                    >
                      Domain expiry reminders
                    </label>
                    <div className="ssl-select-wrap">
                      <select
                        id="domain-expiry-mode"
                        className="ssl-select"
                        value={domainExpiryMode}
                        onChange={(event) =>
                          setDomainExpiryMode(
                            event.target.value === "enabled"
                              ? "enabled"
                              : "disabled",
                          )
                        }
                      >
                        <option value="disabled">Disabled</option>
                        <option value="enabled">Enabled</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>
                </div>
              )}
            </section>

            <button
              type="button"
              className={`monitor-advanced-row advanced-toggle-row ${isAdvancedOpen ? "open" : ""}`}
              onClick={() => setIsAdvancedOpen((prev) => !prev)}
            >
              <ChevronDown
                size={14}
                className={`advanced-toggle-icon ${isAdvancedOpen ? "open" : "closed"}`}
              />
              <span>Advanced settings</span>
            </button>

            {isAdvancedOpen && (
              <section className="advanced-settings-panel">
                <div className="advanced-block">
                  <h4>Request timeout</h4>
                  <p className="advanced-muted-text">
                    The request timeout is{" "}
                    <strong>
                      {timeoutOptions[selectedTimeoutIndex].replace(
                        "s",
                        " seconds",
                      )}
                    </strong>
                    . The shorter the timeout the earlier we mark website as
                    down.
                  </p>
                  <div className="advanced-timeout-slider-wrap">
                    <input
                      className="advanced-timeout-slider"
                      type="range"
                      min={0}
                      max={timeoutOptions.length - 1}
                      step={1}
                      value={selectedTimeoutIndex}
                      onChange={(event) =>
                        setSelectedTimeoutIndex(Number(event.target.value))
                      }
                      style={{
                        ["--range-progress" as string]: `${timeoutProgress}%`,
                      }}
                    />
                    <div className="advanced-timeout-labels" aria-hidden="true">
                      {timeoutOptions.map((timeout, index) => (
                        <span key={`${timeout}-${index}`}>{timeout}</span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <label className="advanced-switch-line">
                      <input
                        type="checkbox"
                        className="advanced-switch-input"
                        checked={slowResponseAlert}
                        onChange={(event) =>
                          setSlowResponseAlert(event.target.checked)
                        }
                      />
                      <span
                        className="advanced-switch-track"
                        aria-hidden="true"
                      />
                      <span className="advanced-row-title">
                        Slow response time alert
                      </span>
                    </label>
                  </div>
                  <p className="advanced-muted-text">
                    You&apos;ll receive a notification if the response time
                    exceeds your set threshold. Once it drops back below the
                    threshold, you&apos;ll be notified again, and the incident
                    will be marked as resolved.
                  </p>
                  <div className="advanced-threshold-input-wrap">
                    <input
                      className="advanced-threshold-input"
                      type="number"
                      value={slowResponseThreshold}
                      onChange={(event) =>
                        setSlowResponseThreshold(event.target.value)
                      }
                      disabled={!slowResponseAlert}
                    />
                    <span>milliseconds</span>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <h4>Internet Protocol version</h4>
                  <p className="advanced-muted-text">
                    Default uses IPv4 first, then IPv6 only if IPv4 isn&apos;t
                    available.
                  </p>
                  <div className="advanced-select-wrap">
                    <select
                      className="advanced-select"
                      value={selectedIpVersion}
                      onChange={(event) =>
                        setSelectedIpVersion(
                          normalizeIpVersionOption(event.target.value),
                        )
                      }
                    >
                      {ipVersionOptions.map((ipVersion) => (
                        <option key={ipVersion} value={ipVersion}>
                          {ipVersion}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <label className="advanced-switch-line">
                    <input
                      type="checkbox"
                      className="advanced-switch-input"
                      checked={followRedirections}
                      onChange={(event) =>
                        setFollowRedirections(event.target.checked)
                      }
                    />
                    <span
                      className="advanced-switch-track"
                      aria-hidden="true"
                    />
                    <span className="advanced-row-title">
                      Follow redirections
                    </span>
                  </label>
                  <p className="advanced-muted-text">
                    If disabled, we return redirections HTTP codes (3xx).
                  </p>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>Up HTTP status codes</h4>
                  </div>
                  <p className="advanced-muted-text">
                    We will create incident when we receive HTTP status code
                    other than defined below.
                  </p>
                  <div className="advanced-status-codes-box">
                    <button
                      type="button"
                      className={`status-code-chip success ${selectedUpStatusCodeGroups.includes("2xx") ? "is-selected" : "is-unselected"}`}
                      aria-pressed={selectedUpStatusCodeGroups.includes("2xx")}
                      onClick={() => toggleUpStatusCodeGroup("2xx")}
                    >
                      <span>2xx</span>
                      <X size={12} />
                    </button>
                    <button
                      type="button"
                      className={`status-code-chip info ${selectedUpStatusCodeGroups.includes("3xx") ? "is-selected" : "is-unselected"}`}
                      aria-pressed={selectedUpStatusCodeGroups.includes("3xx")}
                      onClick={() => toggleUpStatusCodeGroup("3xx")}
                    >
                      <span>3xx</span>
                      <X size={12} />
                    </button>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-auth-head">
                    <h4>Auth. type</h4>
                    <h4>Auth. credentials</h4>
                  </div>
                  <div className="advanced-auth-grid">
                    <div className="advanced-select-wrap">
                      <select
                        className="advanced-select"
                        value={authType}
                        onChange={(event) =>
                          setAuthType(
                            event.target.value === "basic"
                              ? "basic"
                              : event.target.value === "bearer"
                                ? "bearer"
                                : "none",
                          )
                        }
                      >
                        <option value="none">None</option>
                        <option value="basic">Basic</option>
                        <option value="bearer">Bearer Token</option>
                      </select>
                      <ChevronDown size={14} />
                    </div>
                    <input
                      className="advanced-input"
                      type="text"
                      placeholder="Username"
                      value={authUsername}
                      onChange={(event) => setAuthUsername(event.target.value)}
                    />
                    <div className="advanced-password-wrap">
                      <input
                        className="advanced-input"
                        type="password"
                        placeholder="Password"
                        value={authPassword}
                        onChange={(event) =>
                          setAuthPassword(event.target.value)
                        }
                      />
                      <EyeOff size={15} />
                    </div>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>HTTP method</h4>
                  </div>
                  <p className="advanced-muted-text">
                    We suggest using GET to match the default behavior used by
                    UptimeRobot and Uptime Kuma. Use HEAD only when you
                    specifically need a header-only check.
                  </p>
                  <div className="advanced-methods-tabs">
                    {httpMethods.map((method) => (
                      <button
                        key={method}
                        type="button"
                        className={`advanced-method-tab ${selectedHttpMethod === method ? "active" : ""}`}
                        onClick={() => setSelectedHttpMethod(method)}
                      >
                        {method}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>Request body</h4>
                  </div>
                  <textarea
                    className="advanced-textarea"
                    value={requestBody}
                    onChange={(event) => setRequestBody(event.target.value)}
                    disabled={!isBodySupportedForSelectedMethod}
                  />
                  <label className="advanced-switch-line advanced-switch-inline-gap">
                    <input
                      type="checkbox"
                      className="advanced-switch-input"
                      checked={sendAsJson}
                      onChange={(event) => setSendAsJson(event.target.checked)}
                      disabled={!isBodySupportedForSelectedMethod}
                    />
                    <span
                      className="advanced-switch-track"
                      aria-hidden="true"
                    />
                    <span className="advanced-row-title">
                      Send as JSON (application/json)
                    </span>
                  </label>
                  <p className="advanced-muted-text">
                    {isBodySupportedForSelectedMethod
                      ? "Data will be sent as a standard POST (application/x-www-form-urlencoded) unless you check the JSON option."
                      : `Request body is disabled for ${selectedHttpMethod}. Use POST, PUT or PATCH to send a body.`}
                  </p>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>Request headers</h4>
                  </div>
                  {requestHeaders.map((header) => (
                    <div className="advanced-headers-grid" key={header.id}>
                      <input
                        className="advanced-input"
                        type="text"
                        placeholder="Header key"
                        value={header.key}
                        onChange={(event) =>
                          updateRequestHeader(
                            header.id,
                            "key",
                            event.target.value,
                          )
                        }
                      />
                      <input
                        className="advanced-input"
                        type="text"
                        placeholder="Header value"
                        value={header.value}
                        onChange={(event) =>
                          updateRequestHeader(
                            header.id,
                            "value",
                            event.target.value,
                          )
                        }
                      />
                      <button
                        type="button"
                        className="advanced-header-delete"
                        aria-label="Delete header row"
                        onClick={() => removeRequestHeader(header.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="advanced-header-add"
                    onClick={addRequestHeader}
                  >
                    + Add header
                  </button>
                </div>

                <div className="advanced-divider" />

                {!isResponseValidationEnabled ? (
                  <button
                    type="button"
                    className="advanced-validation-add"
                    onClick={() => setIsResponseValidationEnabled(true)}
                  >
                    + Add validations
                  </button>
                ) : (
                  <div className="advanced-block">
                    <div className="advanced-row-top advanced-row-top-split">
                      <h4>Validation</h4>
                      <button
                        type="button"
                        className="advanced-validation-remove"
                        onClick={() => setIsResponseValidationEnabled(false)}
                      >
                        Remove
                      </button>
                    </div>
                    <p className="advanced-muted-text">
                      Validate response JSON field <strong>status</strong> by
                      value or by type.
                    </p>

                    <div className="advanced-validation-grid">
                      <div className="advanced-validation-field-name">
                        <label>Field</label>
                        <input
                          className="advanced-input"
                          type="text"
                          value="status"
                          disabled
                        />
                      </div>

                      <label className="advanced-validation-mode">
                        <span>Mode</span>
                        <select
                          className="advanced-select"
                          value={responseValidationMode}
                          onChange={(event) =>
                            setResponseValidationMode(
                              event.target.value === "type" ? "type" : "value",
                            )
                          }
                        >
                          <option value="value">of value</option>
                          <option value="type">of type</option>
                        </select>
                      </label>

                      {responseValidationMode === "value" ? (
                        <label className="advanced-validation-expected">
                          <span>Expected value</span>
                          <input
                            className="advanced-input"
                            type="text"
                            placeholder='e.g. "up"'
                            value={responseValidationValue}
                            onChange={(event) =>
                              setResponseValidationValue(event.target.value)
                            }
                          />
                        </label>
                      ) : (
                        <label className="advanced-validation-expected">
                          <span>Expected type</span>
                          <select
                            className="advanced-select"
                            value={responseValidationType}
                            onChange={(event) =>
                              setResponseValidationType(
                                event.target.value === "boolean"
                                  ? "boolean"
                                  : event.target.value === "number"
                                    ? "number"
                                    : "string",
                              )
                            }
                          >
                            <option value="string">string</option>
                            <option value="boolean">boolean</option>
                            <option value="number">number</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="new-monitor-field tags-field">
              <label htmlFor="new-monitor-tags">Add tags</label>
              <p className="tag-help">
                Optional. We use this to group monitors, so you are able to
                easily manage them in bulk or organize on status pages.
              </p>
              <input
                id="new-monitor-tags"
                className="new-monitor-input"
                type="text"
                placeholder="Add tag ..."
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </div>
          </section>

          <section className="new-monitor-submit-card">
            {createError ? (
              <p className="new-monitor-submit-error">{createError}</p>
            ) : null}
            <button
              type="button"
              onClick={handleCreateMonitor}
              disabled={isCreateDisabled}
            >
              {isCreating ? "Creating..." : "Create monitor"}
            </button>
          </section>
        </div>

        <aside className="new-monitor-side-card">
          <button
            type="button"
            className={`new-monitor-side-title-link ${activeSideSection === "details" ? "active" : ""}`}
            onClick={() => {
              scrollToSection("details");
            }}
          >
            Monitor details
          </button>
          <button
            type="button"
            className={`new-monitor-side-link ${activeSideSection === "integrations" ? "active" : ""}`}
            onClick={() => {
              scrollToSection("integrations");
            }}
          >
            Integrations & Team
          </button>
          <button
            type="button"
            className={`new-monitor-side-link ${activeSideSection === "maintenance" ? "active" : ""}`}
            onClick={() => {
              scrollToSection("maintenance");
            }}
          >
            Maintenance info
          </button>
        </aside>
      </div>

      {isPhoneModalOpen ? (
        <div
          className="new-monitor-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePhoneModal();
            }
          }}
        >
          <div
            className="new-monitor-modal new-monitor-phone-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-phone-number-title"
          >
            <div className="new-monitor-phone-modal-top">
              <button
                type="button"
                className="new-monitor-modal-close new-monitor-phone-modal-close"
                onClick={closePhoneModal}
                aria-label="Close"
              >
                <X size={16} />
              </button>
              <span className="new-monitor-phone-modal-icon" aria-hidden="true">
                <Smartphone size={30} />
              </span>
              <h3 id="add-phone-number-title">Add your phone number</h3>
            </div>

            <div className="new-monitor-phone-modal-body">
              <h4>Enter your number</h4>
              <p className="new-monitor-phone-modal-copy">
                We use this for SMS and voice call notifications.
              </p>

              <div
                className="new-monitor-phone-country-picker"
                ref={phoneCountryMenuRef}
              >
                <div className="new-monitor-phone-input-row">
                  <div className="new-monitor-phone-country">
                    <button
                      id="new-monitor-country-code"
                      type="button"
                      className="new-monitor-phone-country-trigger"
                      aria-haspopup="listbox"
                      aria-expanded={isPhoneCountryMenuOpen}
                      onClick={() =>
                        setIsPhoneCountryMenuOpen(
                          (previousState) => !previousState,
                        )
                      }
                    >
                      <span
                        className="new-monitor-phone-country-flag"
                        aria-hidden="true"
                      >
                        {selectedPhoneCountryOption
                          ? getPhoneCountryAbbreviation(
                              selectedPhoneCountryOption.label,
                            )
                          : "--"}
                      </span>
                      <span className="new-monitor-phone-country-trigger-text">
                        {selectedPhoneCountryOption
                          ? `${selectedPhoneCountryOption.dialCode}`
                          : ""}
                      </span>
                      <ChevronDown
                        size={14}
                        className={isPhoneCountryMenuOpen ? "open" : ""}
                      />
                    </button>
                  </div>
                  <input
                    id="new-monitor-phone-number"
                    className="new-monitor-phone-number-input"
                    type="tel"
                    value={phoneLocalNumberDraft}
                    onChange={(event) => {
                      setPhoneLocalNumberDraft(event.target.value);
                      setPhoneDraftError(null);
                    }}
                    autoFocus
                  />
                </div>

                {isPhoneCountryMenuOpen ? (
                  <div className="new-monitor-phone-country-menu">
                    <div className="new-monitor-phone-country-search-wrap">
                      <input
                        type="text"
                        className="new-monitor-phone-country-search-input"
                        placeholder="Search country or code"
                        value={phoneCountrySearchQuery}
                        onChange={(event) =>
                          setPhoneCountrySearchQuery(event.target.value)
                        }
                        autoFocus
                      />
                    </div>
                    <div
                      className="new-monitor-phone-country-options"
                      role="listbox"
                      aria-label="Country codes"
                    >
                      {filteredPhoneCountryOptions.length > 0 ? (
                        filteredPhoneCountryOptions.map((countryOption) => (
                          <button
                            key={countryOption.id}
                            type="button"
                            role="option"
                            aria-selected={
                              phoneCountryIdDraft === countryOption.id
                            }
                            className={`new-monitor-phone-country-option ${phoneCountryIdDraft === countryOption.id ? "active" : ""}`}
                            onClick={() => {
                              setPhoneCountryIdDraft(countryOption.id);
                              setPhoneDraftError(null);
                              setIsPhoneCountryMenuOpen(false);
                            }}
                          >
                            <span className="new-monitor-phone-country-option-main">
                              <span
                                className="new-monitor-phone-country-flag"
                                aria-hidden="true"
                              >
                                {getPhoneCountryAbbreviation(
                                  countryOption.label,
                                )}
                              </span>
                              <span>{countryOption.label}</span>
                            </span>
                            <span className="new-monitor-phone-country-option-code">
                              {countryOption.dialCode}
                            </span>
                          </button>
                        ))
                      ) : (
                        <p className="new-monitor-phone-country-empty">
                          No countries found.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              <p
                className={`new-monitor-phone-error ${phoneDraftError ? "" : "is-empty"}`}
              >
                {phoneDraftError ?? " "}
              </p>

              <p className="new-monitor-phone-step-note">
                In the next step we will send you the confirmation code.
              </p>

              <div className="new-monitor-phone-divider" />

              <div className="new-monitor-modal-actions new-monitor-phone-modal-actions">
                <button
                  type="button"
                  className="new-monitor-modal-cancel"
                  onClick={closePhoneModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="new-monitor-modal-confirm new-monitor-phone-next"
                  onClick={savePhoneNumber}
                  disabled={phoneLocalNumberDraft.trim() === ""}
                >
                  Next: Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isTimingModalOpen ? (
        <div
          className="new-monitor-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeTimingModal();
            }
          }}
        >
          <div
            className="new-monitor-modal new-monitor-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-timing-title"
          >
            <div className="new-monitor-modal-header">
              <h3 id="notification-timing-title">
                Notification Repeat and Delay
              </h3>
              <button
                type="button"
                className="new-monitor-modal-close"
                onClick={closeTimingModal}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <p className="new-monitor-modal-copy">
              Currently editing settings for{" "}
              <strong>{notificationChannelLabels[timingModalChannel]}</strong>.
            </p>

            <div className="new-monitor-timing-grid">
              <label
                className="new-monitor-modal-field"
                htmlFor="notification-repeat-select"
              >
                <span>Repeat notification</span>
                <select
                  id="notification-repeat-select"
                  value={timingRepeatDraft}
                  onChange={(event) =>
                    setTimingRepeatDraft(
                      event.target.value as NotificationRepeat,
                    )
                  }
                >
                  <option value="none">No repeat</option>
                  <option value="every-check">Repeat every check</option>
                  <option value="hourly">Repeat hourly</option>
                  <option value="daily">Repeat daily</option>
                </select>
              </label>

              <label
                className="new-monitor-modal-field"
                htmlFor="notification-delay-select"
              >
                <span>Delay notification</span>
                <select
                  id="notification-delay-select"
                  value={timingDelayDraft}
                  onChange={(event) =>
                    setTimingDelayDraft(event.target.value as NotificationDelay)
                  }
                >
                  <option value="none">No delay</option>
                  <option value="1m">Delay 1 minute</option>
                  <option value="5m">Delay 5 minutes</option>
                  <option value="15m">Delay 15 minutes</option>
                </select>
              </label>
            </div>

            <article className="new-monitor-notification-preview">
              <h4>Notification preview</h4>
              <p>{timingPreview}</p>
            </article>

            <div className="new-monitor-modal-actions">
              <button
                type="button"
                className="new-monitor-modal-cancel"
                onClick={closeTimingModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="new-monitor-modal-confirm"
                onClick={saveTimingSettings}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default NewMonitorPage;
