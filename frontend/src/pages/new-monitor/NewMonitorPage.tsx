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
import { useAppLanguage } from "../../lib/language";

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
const ipVersionLabelKeys: Record<MonitorIpVersionUI, string> = {
  "IPv4 / IPv6 (IPv4 Priority)": "newMonitor.ipVersionOptions.ipv4Ipv6Priority",
  "IPv6 / IPv4 (IPv6 Priority)": "newMonitor.ipVersionOptions.ipv6Ipv4Priority",
  "IPv4 only": "newMonitor.ipVersionOptions.ipv4Only",
  "IPv6 only": "newMonitor.ipVersionOptions.ipv6Only",
};
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
  titleKey: string;
  descriptionKey: string;
  placeholder: string;
}

const protocolOptions: ProtocolOption[] = [
  {
    value: "http",
    badge: "HTTP://",
    titleKey: "newMonitor.protocol.http.title",
    descriptionKey: "newMonitor.protocol.http.description",
    placeholder: "http://",
  },
  {
    value: "https",
    badge: "HTTPS://",
    titleKey: "newMonitor.protocol.https.title",
    descriptionKey: "newMonitor.protocol.https.description",
    placeholder: "https://",
  },
  {
    value: "ws",
    badge: "WS://",
    titleKey: "newMonitor.protocol.ws.title",
    descriptionKey: "newMonitor.protocol.ws.description",
    placeholder: "ws://",
  },
  {
    value: "wss",
    badge: "WSS://",
    titleKey: "newMonitor.protocol.wss.title",
    descriptionKey: "newMonitor.protocol.wss.description",
    placeholder: "wss://",
  },
];

const protocolPrefixes: Record<MonitorProtocol, string> = {
  http: "http://",
  https: "https://",
  ws: "ws://",
  wss: "wss://",
};

const notificationChannelLabelKeys: Record<NotificationChannel, string> = {
  email: "newMonitor.notificationChannels.email",
  sms: "newMonitor.notificationChannels.sms",
  voice: "newMonitor.notificationChannels.voice",
  push: "newMonitor.notificationChannels.push",
};

const repeatOptionLabelKeys: Record<NotificationRepeat, string> = {
  none: "newMonitor.timing.noRepeat",
  "every-check": "newMonitor.timing.repeatEveryCheck",
  hourly: "newMonitor.timing.repeatHourly",
  daily: "newMonitor.timing.repeatDaily",
};

const delayOptionLabelKeys: Record<NotificationDelay, string> = {
  none: "newMonitor.timing.noDelay",
  "1m": "newMonitor.timing.delay1Minute",
  "5m": "newMonitor.timing.delay5Minutes",
  "15m": "newMonitor.timing.delay15Minutes",
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
  const { t, language } = useAppLanguage();
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
  const translatedProtocolOptions = useMemo(
    () =>
      protocolOptions.map((option) => ({
        ...option,
        title: t(option.titleKey),
        description: t(option.descriptionKey),
      })),
    [t],
  );
  const resolvedNotificationEmail =
    (notificationEmail ?? "").trim() || t("newMonitor.noEmailConnected");
  const selectedIntervalLabel = useMemo(
    () => intervalOptions[selectedIntervalIndex] ?? intervalOptions[2],
    [selectedIntervalIndex],
  );
  const selectedProtocolOption = useMemo(
    () =>
      translatedProtocolOptions.find(
        (option) => option.value === selectedProtocol,
      ) ?? translatedProtocolOptions[0],
    [selectedProtocol, translatedProtocolOptions],
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
        error: t("newMonitor.phoneErrors.required"),
        normalizedPhone: "",
      };
    }

    if (!/^[0-9\s\-()]+$/.test(normalizedLocalNumber)) {
      return {
        isValid: false,
        error: t("newMonitor.phoneErrors.digitsOnly"),
        normalizedPhone: "",
      };
    }

    const dialDigits = extractPhoneDigits(normalizedCountryCode);
    const localDigits = extractPhoneDigits(normalizedLocalNumber);

    if (localDigits.length < 6 || localDigits.length > 14) {
      return {
        isValid: false,
        error: t("newMonitor.phoneErrors.length"),
        normalizedPhone: "",
      };
    }

    if (/^0+$/.test(localDigits)) {
      return {
        isValid: false,
        error: t("newMonitor.phoneErrors.invalid"),
        normalizedPhone: "",
      };
    }

    const totalDigits = dialDigits.length + localDigits.length;
    if (totalDigits < 8 || totalDigits > 15) {
      return {
        isValid: false,
        error: t("newMonitor.phoneErrors.internationalFormat"),
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
      setPhoneDraftError(validation.error ?? t("newMonitor.phoneErrors.invalid"));
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

  const localizeSentenceCase = (value: string): string =>
    language === "ar" ? value : value.toLowerCase();

  const formatNotificationTiming = (timing: NotificationTiming): string => {
    const delayLabel = t(delayOptionLabelKeys[timing.delay]);
    const repeatLabel = t(repeatOptionLabelKeys[timing.repeat]);

    if (timing.delay === "none" && timing.repeat === "none") {
      return t("newMonitor.timing.noDelayNoRepeat");
    }

    return t("newMonitor.timing.summary", {
      delay: delayLabel,
      repeat: localizeSentenceCase(repeatLabel),
    });
  };

  const timingPreview = t("newMonitor.timing.preview", {
    channel: t(notificationChannelLabelKeys[timingModalChannel]),
    delay: t(delayOptionLabelKeys[timingDelayDraft]),
    repeat: localizeSentenceCase(t(repeatOptionLabelKeys[timingRepeatDraft])),
  });
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
          {t("menu.monitoring")}
        </button>
        <ChevronRight size={14} />
        <span>{t("menu.monitoring")}</span>
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
                    aria-label={t("newMonitor.aria.selectProtocol")}
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
                  aria-label={t("newMonitor.aria.monitorProtocol")}
                >
                  {translatedProtocolOptions.map((option) => (
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
              <label htmlFor="new-monitor-name">{t("newMonitor.monitorNameLabel")}</label>
              <input
                id="new-monitor-name"
                className="new-monitor-input"
                type="text"
                placeholder={t("newMonitor.monitorNamePlaceholder")}
                value={monitorName}
                onChange={(event) => setMonitorName(event.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="new-monitor-separator" />

            <div className="new-monitor-field">
              <label htmlFor="new-monitor-url">{t("newMonitor.urlToMonitorLabel")}</label>
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
              <h3>{t("newMonitor.howWillWeNotifyYou")}</h3>
              <div className="new-monitor-notify-grid">
                <article className="notify-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={enabledNotificationChannels.email}
                      onChange={() => handleToggleNotificationChannel("email")}
                    />
                    <span>{t(notificationChannelLabelKeys.email)}</span>
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
                    <span>{t(notificationChannelLabelKeys.sms)}</span>
                  </label>
                  {notificationPhoneNumber.trim() === "" ? (
                    <button
                      type="button"
                      className="notify-phone-action"
                      onClick={() => openPhoneModal("sms")}
                    >
                      {t("newMonitor.addPhoneNumber")}
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
                    <span>{t(notificationChannelLabelKeys.voice)}</span>
                  </label>
                  {notificationPhoneNumber.trim() === "" ? (
                    <button
                      type="button"
                      className="notify-phone-action"
                      onClick={() => openPhoneModal("voice")}
                    >
                      {t("newMonitor.addPhoneNumber")}
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
                    <span>{t(notificationChannelLabelKeys.push)}</span>
                  </label>
                  <p className="notify-option-value">
                    {t("newMonitor.downloadAppFor")}{" "}
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
                {t("newMonitor.notificationFootnote.prefix")}{" "}
                <button
                  type="button"
                  className="notify-inline-action"
                  onClick={() => {
                    scrollToSection("integrations");
                  }}
                >
                  {t("newMonitor.integrationsTeam")}
                </button>{" "}
                {t("newMonitor.notificationFootnote.suffix")}
              </p>
            </section>
          </section>

          <section className="new-monitor-card" ref={maintenanceSectionRef}>
            <h3>{t("newMonitor.monitorInterval")}</h3>
            <p className="monitor-interval-description">
              {t("newMonitor.monitorIntervalDescription.prefix")}{" "}
              <strong>{selectedIntervalLabel}</strong>
              {t("newMonitor.monitorIntervalDescription.suffix")}
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
                  <span>{t("newMonitor.sslCertificateAndDomainChecks")}</span>
                </button>
              </div>

              {isSslDomainOpen && (
                <div className="ssl-domain-options">
                  <div className="ssl-select-item">
                    <label
                      htmlFor="ssl-check-mode"
                      className="ssl-select-label"
                    >
                      {t("newMonitor.checkSslErrors")}
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
                        <option value="disabled">{t("common.disabled")}</option>
                        <option value="enabled">{t("common.enabled")}</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>

                  <div className="ssl-select-item">
                    <label
                      htmlFor="ssl-expiry-mode"
                      className="ssl-select-label"
                    >
                      {t("newMonitor.sslExpiryReminders")}
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
                        <option value="disabled">{t("common.disabled")}</option>
                        <option value="enabled">{t("common.enabled")}</option>
                      </select>
                      <ChevronDown size={12} />
                    </div>
                  </div>

                  <div className="ssl-select-item">
                    <label
                      htmlFor="domain-expiry-mode"
                      className="ssl-select-label"
                    >
                      {t("newMonitor.domainExpiryReminders")}
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
                        <option value="disabled">{t("common.disabled")}</option>
                        <option value="enabled">{t("common.enabled")}</option>
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
              <span>{t("newMonitor.advancedSettings")}</span>
            </button>

            {isAdvancedOpen && (
              <section className="advanced-settings-panel">
                <div className="advanced-block">
                  <h4>{t("newMonitor.requestTimeout")}</h4>
                  <p className="advanced-muted-text">
                    {t("newMonitor.requestTimeoutDescription.prefix")}{" "}
                    <strong>
                      {timeoutOptions[selectedTimeoutIndex]}
                    </strong>
                    {t("newMonitor.requestTimeoutDescription.suffix")}
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
                        {t("newMonitor.slowResponseTimeAlert")}
                      </span>
                    </label>
                  </div>
                  <p className="advanced-muted-text">
                    {t("newMonitor.slowResponseAlertDescription")}
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
                    <span>{t("newMonitor.milliseconds")}</span>
                  </div>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <h4>{t("newMonitor.internetProtocolVersion")}</h4>
                  <p className="advanced-muted-text">
                    {t("newMonitor.internetProtocolVersionDescription")}
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
                          {t(ipVersionLabelKeys[ipVersion])}
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
                      {t("newMonitor.followRedirections")}
                      </span>
                  </label>
                  <p className="advanced-muted-text">
                    {t("newMonitor.followRedirectionsDescription")}
                  </p>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>{t("newMonitor.upHttpStatusCodes")}</h4>
                  </div>
                  <p className="advanced-muted-text">
                    {t("newMonitor.upHttpStatusCodesDescription")}
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
                    <h4>{t("newMonitor.authType")}</h4>
                    <h4>{t("newMonitor.authCredentials")}</h4>
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
                        <option value="none">{t("newMonitor.auth.none")}</option>
                        <option value="basic">{t("newMonitor.auth.basic")}</option>
                        <option value="bearer">{t("newMonitor.auth.bearerToken")}</option>
                      </select>
                      <ChevronDown size={14} />
                    </div>
                    <input
                      className="advanced-input"
                      type="text"
                      placeholder={t("newMonitor.usernamePlaceholder")}
                      value={authUsername}
                      onChange={(event) => setAuthUsername(event.target.value)}
                    />
                    <div className="advanced-password-wrap">
                      <input
                        className="advanced-input"
                        type="password"
                        placeholder={t("newMonitor.passwordPlaceholder")}
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
                    <h4>{t("newMonitor.httpMethod")}</h4>
                  </div>
                  <p className="advanced-muted-text">
                    {t("newMonitor.httpMethodDescription")}
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
                    <h4>{t("newMonitor.requestBody")}</h4>
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
                      {t("newMonitor.sendAsJson")}
                      </span>
                  </label>
                  <p className="advanced-muted-text">
                    {isBodySupportedForSelectedMethod
                      ? t("newMonitor.requestBodyEnabledDescription")
                      : t("newMonitor.requestBodyDisabledDescription", {
                          method: selectedHttpMethod,
                        })}
                  </p>
                </div>

                <div className="advanced-divider" />

                <div className="advanced-block">
                  <div className="advanced-row-top">
                    <h4>{t("newMonitor.requestHeaders")}</h4>
                  </div>
                  {requestHeaders.map((header) => (
                    <div className="advanced-headers-grid" key={header.id}>
                      <input
                        className="advanced-input"
                        type="text"
                        placeholder={t("newMonitor.headerKeyPlaceholder")}
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
                        placeholder={t("newMonitor.headerValuePlaceholder")}
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
                        aria-label={t("newMonitor.deleteHeaderRow")}
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
                    + {t("newMonitor.addHeader")}
                  </button>
                </div>

                <div className="advanced-divider" />

                {!isResponseValidationEnabled ? (
                  <button
                    type="button"
                    className="advanced-validation-add"
                    onClick={() => setIsResponseValidationEnabled(true)}
                  >
                    + {t("newMonitor.addValidations")}
                  </button>
                ) : (
                  <div className="advanced-block">
                    <div className="advanced-row-top advanced-row-top-split">
                      <h4>{t("newMonitor.validation")}</h4>
                      <button
                        type="button"
                        className="advanced-validation-remove"
                        onClick={() => setIsResponseValidationEnabled(false)}
                      >
                        {t("common.remove")}
                      </button>
                    </div>
                    <p className="advanced-muted-text">
                      {t("newMonitor.validationDescription")} <strong>status</strong>{' '}
                      {t("newMonitor.validationDescriptionSuffix")}
                    </p>

                    <div className="advanced-validation-grid">
                      <div className="advanced-validation-field-name">
                        <label>{t("newMonitor.validationField")}</label>
                        <input
                          className="advanced-input"
                          type="text"
                          value="status"
                          disabled
                        />
                      </div>

                      <label className="advanced-validation-mode">
                        <span>{t("newMonitor.validationMode")}</span>
                        <select
                          className="advanced-select"
                          value={responseValidationMode}
                          onChange={(event) =>
                            setResponseValidationMode(
                              event.target.value === "type" ? "type" : "value",
                            )
                          }
                          >
                          <option value="value">{t("newMonitor.validationModeValue")}</option>
                          <option value="type">{t("newMonitor.validationModeType")}</option>
                        </select>
                      </label>

                      {responseValidationMode === "value" ? (
                        <label className="advanced-validation-expected">
                          <span>{t("newMonitor.expectedValue")}</span>
                          <input
                            className="advanced-input"
                            type="text"
                            placeholder={t("newMonitor.expectedValuePlaceholder")}
                            value={responseValidationValue}
                            onChange={(event) =>
                              setResponseValidationValue(event.target.value)
                            }
                          />
                        </label>
                      ) : (
                        <label className="advanced-validation-expected">
                          <span>{t("newMonitor.expectedType")}</span>
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
                            <option value="string">{t("newMonitor.validationTypeString")}</option>
                            <option value="boolean">{t("newMonitor.validationTypeBoolean")}</option>
                            <option value="number">{t("newMonitor.validationTypeNumber")}</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </section>
            )}

            <div className="new-monitor-field tags-field">
              <label htmlFor="new-monitor-tags">{t("newMonitor.addTags")}</label>
              <p className="tag-help">
                {t("newMonitor.tagsHelp")}
              </p>
              <input
                id="new-monitor-tags"
                className="new-monitor-input"
                type="text"
                placeholder={t("newMonitor.tagPlaceholder")}
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
              {isCreating ? t("common.creating") : t("newMonitor.createMonitor")}
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
            {t("newMonitor.side.details")}
          </button>
          <button
            type="button"
            className={`new-monitor-side-link ${activeSideSection === "integrations" ? "active" : ""}`}
            onClick={() => {
              scrollToSection("integrations");
            }}
          >
            {t("newMonitor.side.integrationsTeam")}
          </button>
          <button
            type="button"
            className={`new-monitor-side-link ${activeSideSection === "maintenance" ? "active" : ""}`}
            onClick={() => {
              scrollToSection("maintenance");
            }}
          >
            {t("newMonitor.side.maintenanceInfo")}
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
                aria-label={t("common.close")}
              >
                <X size={16} />
              </button>
              <span className="new-monitor-phone-modal-icon" aria-hidden="true">
                <Smartphone size={30} />
              </span>
              <h3 id="add-phone-number-title">{t("newMonitor.phoneModalTitle")}</h3>
            </div>

            <div className="new-monitor-phone-modal-body">
              <h4>{t("newMonitor.phoneModalEnterNumber")}</h4>
              <p className="new-monitor-phone-modal-copy">
                {t("newMonitor.phoneModalCopy")}
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
                        placeholder={t("newMonitor.searchCountryOrCode")}
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
                      aria-label={t("newMonitor.countryCodes")}
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
                          {t("newMonitor.noCountriesFound")}
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
                {t("newMonitor.phoneStepNote")}
              </p>

              <div className="new-monitor-phone-divider" />

              <div className="new-monitor-modal-actions new-monitor-phone-modal-actions">
                <button
                  type="button"
                  className="new-monitor-modal-cancel"
                  onClick={closePhoneModal}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="new-monitor-modal-confirm new-monitor-phone-next"
                  onClick={savePhoneNumber}
                  disabled={phoneLocalNumberDraft.trim() === ""}
                >
                  {t("newMonitor.nextConfirm")}
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
                {t("newMonitor.notificationRepeatAndDelay")}
              </h3>
              <button
                type="button"
                className="new-monitor-modal-close"
                onClick={closeTimingModal}
                aria-label={t("common.close")}
              >
                <X size={16} />
              </button>
            </div>

            <p className="new-monitor-modal-copy">
              {t("newMonitor.currentlyEditingSettingsFor")}{" "}
              <strong>{t(notificationChannelLabelKeys[timingModalChannel])}</strong>.
            </p>

            <div className="new-monitor-timing-grid">
              <label
                className="new-monitor-modal-field"
                htmlFor="notification-repeat-select"
              >
                <span>{t("newMonitor.repeatNotification")}</span>
                <select
                  id="notification-repeat-select"
                  value={timingRepeatDraft}
                  onChange={(event) =>
                    setTimingRepeatDraft(
                      event.target.value as NotificationRepeat,
                    )
                  }
                >
                  <option value="none">{t(repeatOptionLabelKeys.none)}</option>
                  <option value="every-check">{t(repeatOptionLabelKeys["every-check"])}</option>
                  <option value="hourly">{t(repeatOptionLabelKeys.hourly)}</option>
                  <option value="daily">{t(repeatOptionLabelKeys.daily)}</option>
                </select>
              </label>

              <label
                className="new-monitor-modal-field"
                htmlFor="notification-delay-select"
              >
                <span>{t("newMonitor.delayNotification")}</span>
                <select
                  id="notification-delay-select"
                  value={timingDelayDraft}
                  onChange={(event) =>
                    setTimingDelayDraft(event.target.value as NotificationDelay)
                  }
                >
                  <option value="none">{t(delayOptionLabelKeys.none)}</option>
                  <option value="1m">{t(delayOptionLabelKeys["1m"])}</option>
                  <option value="5m">{t(delayOptionLabelKeys["5m"])}</option>
                  <option value="15m">{t(delayOptionLabelKeys["15m"])}</option>
                </select>
              </label>
            </div>

            <article className="new-monitor-notification-preview">
              <h4>{t("newMonitor.notificationPreview")}</h4>
              <p>{timingPreview}</p>
            </article>

            <div className="new-monitor-modal-actions">
              <button
                type="button"
                className="new-monitor-modal-cancel"
                onClick={closeTimingModal}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="new-monitor-modal-confirm"
                onClick={saveTimingSettings}
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default NewMonitorPage;
