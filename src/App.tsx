import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import {
  ActionIcon,
  Box,
  Center,
  Code,
  createTheme,
  Flex,
  Input,
  Loader,
  MantineProvider,
  TextInput,
  Tooltip,
} from "@mantine/core";
import "@mantine/core/styles.css";
import {
  DateInput,
  DatePicker,
  DatesProvider,
  type DayOfWeek,
} from "@mantine/dates";
import "@mantine/dates/styles.css";
import { useForm } from "@mantine/form";
import { useClipboard } from "@mantine/hooks";
import {
  Icon123,
  IconAbc,
  IconCalendar,
  IconCopy,
  IconCopyCheck,
  IconFile,
  IconMapPin,
  IconWorld,
} from "@tabler/icons-react";
import {
  addDays,
  format as formatDate,
  getDate,
  getDay,
  getMonth,
  getYear,
  parse as parseDate,
  startOfMonth,
} from "date-fns";
import { Suspense, use, useMemo } from "react";
import { messages } from "./locales/en/messages.po";
import PlacePicker from "./PlacePicker";

i18n.loadAndActivate({ locale: "en", messages });

const QUERY_PARAMS = new URLSearchParams(window.location.search);
const conPromise = (async () => {
  const con = QUERY_PARAMS.get("con");
  if (con == null) {
    return null;
  }
  const resp = await fetch(`https://data.cons.fyi/cons/${con}.json`);
  if (!resp.ok) {
    throw resp;
  }
  return (await resp.json()) as {
    name: string;
    events: {
      id: string;
      name: string;
      url: string;
      startDate: string;
      endDate: string;
      location: string;
      country?: string;
      latLng?: [number, number];
      sources?: string[];
      canceled?: true;
      conId: string;
      timezone?: string;
    }[];
  };
})();

function guessLanguageForRegion(regionCode: string) {
  // "und" stands for "undetermined language" — like ICU's fallback
  return new Intl.Locale(`und-${regionCode}`).maximize().baseName;
}

function slugify(s: string, locale: string) {
  return s
    .normalize("NFKC")
    .toLocaleLowerCase(locale)
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .trim()
    .split(/\s+/)
    .join("-");
}

function getWeekOfMonth(date: Date) {
  return Math.ceil((getDate(date) + getDay(startOfMonth(date))) / 7);
}

function getWeekdayInNthWeek(
  year: number,
  month: number,
  weekday: DayOfWeek,
  week: number,
) {
  const firstOfMonth = new Date(year, month, 1);
  const firstDayOfWeek = getDay(firstOfMonth);
  return addDays(firstOfMonth, -firstDayOfWeek + weekday + (week - 1) * 7);
}

function addYearSameWeekday(date: Date) {
  return getWeekdayInNthWeek(
    getYear(date) + 1,
    getMonth(date),
    getDay(date) as DayOfWeek,
    getWeekOfMonth(date),
  );
}

function Editor() {
  const templateCon = use(conPromise);

  let initialValues: {
    prefix: string;
    suffix: string;
    dates: [string | null, string | null];
    url: string;
    location: string;
    country?: string;
    latLng?: [number, number];
  } = {
    prefix: "",
    suffix: "",
    dates: [null, null],
    url: "",
    location: "",
    country: undefined,
    latLng: undefined,
  };
  if (templateCon != null && templateCon.events.length > 0) {
    const event = templateCon.events[templateCon.events.length - 1];

    let suffix = (getYear(new Date(event.startDate)) + 1).toString();
    const match = event.name.match(/(\d+)$/);
    if (match != null) {
      suffix = (parseInt(match[1], 10) + 1).toString();
    }

    const refDate = new Date();
    const [startDate, endDate] = [event.startDate, event.endDate].map((d) =>
      parseDate(d, "yyyy-MM-dd", refDate),
    );

    initialValues = {
      ...initialValues,
      prefix: templateCon.name,
      suffix,
      url: event.url,
      dates: [addYearSameWeekday(startDate), addYearSameWeekday(endDate)].map(
        (d) => formatDate(d, "yyyy-MM-dd"),
      ) as [string, string],
      location: event.location,
      country: event.country,
      latLng: event.latLng,
    };
  }

  const { i18n, t } = useLingui();

  const form = useForm({
    mode: "controlled",
    initialValues,
    validateInputOnChange: true,
    validate: {
      prefix: (value) =>
        value == "" ? <Trans>Prefix must not be empty.</Trans> : null,
      suffix: (value) =>
        value == "" ? <Trans>Suffix must not be empty.</Trans> : null,
      url: (value) =>
        value == "" ? <Trans>Website must not be empty.</Trans> : null,
      dates: ([startDate, endDate]) =>
        startDate == null && endDate == null ? (
          <Trans>Dates must be set.</Trans>
        ) : startDate == null ? (
          <Trans>Start date must be set.</Trans>
        ) : endDate == null ? (
          <Trans>End date must be set.</Trans>
        ) : startDate > endDate ? (
          <Trans>Start date must before or on end date.</Trans>
        ) : null,
      location: (value) =>
        value == "" ? <Trans>Location must be set.</Trans> : null,
    },
  });

  const prefixInputProps = form.getInputProps("prefix");
  const suffixInputProps = form.getInputProps("suffix");
  const datesInputProps = form.getInputProps("dates");
  const locationInputProps = form.getInputProps("location");

  const refDate = new Date();
  const [startDate, endDate] = datesInputProps.value.map((d: string | null) =>
    d != null ? parseDate(d, "yyyy-MM-dd", refDate) : null,
  ) as [Date | null, Date | null];

  const conId = useMemo(
    () =>
      slugify(
        form.values.prefix,
        form.values.country != undefined
          ? guessLanguageForRegion(form.values.country)
          : "en",
      ),
    [form.values.country, form.values.prefix],
  );

  const raw = useMemo(() => {
    const values = form.getValues();

    const [startDate, endDate] = values.dates;

    return JSON.stringify(
      {
        name: values.prefix,
        events: [
          {
            id: `${conId}-${startDate != null ? getYear(startDate).toString() : ""}`,
            name: `${values.prefix} ${values.suffix}`,
            url: values.url,
            startDate: startDate ?? "",
            endDate: endDate ?? "",
            location: values.location,
            country: values.country,
            latLng: values.latLng,
          },
          ...(templateCon != null
            ? templateCon.events.map(
                (
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  { timezone, conId, ...event },
                ) => event,
              )
            : []),
        ],
      },
      null,
      "  ",
    );
  }, [templateCon, conId, form]);

  const clipboard = useClipboard();

  return (
    <Flex w="100%" gap="xs" p="xs">
      <form
        style={{ width: "800px" }}
        onSubmit={form.onSubmit((values) => {
          console.log(values);
        })}
      >
        <Input.Wrapper
          {...form.getInputProps("name")}
          size="sm"
          mb="xs"
          label={<Trans>Name</Trans>}
          error={
            prefixInputProps.error != null || suffixInputProps.error != null ? (
              <>
                {prefixInputProps.error} {suffixInputProps.error}
              </>
            ) : null
          }
        >
          <Flex w="100%">
            <Input
              {...prefixInputProps}
              style={{ flexGrow: 1 }}
              leftSection={<IconAbc size={16} />}
            />
            <Input {...suffixInputProps} leftSection={<Icon123 size={16} />} />
          </Flex>
        </Input.Wrapper>
        <TextInput
          {...form.getInputProps("url")}
          size="sm"
          mb="xs"
          label={<Trans>Website</Trans>}
          leftSection={<IconWorld size={16} />}
        />
        <Input.Wrapper
          size="sm"
          mb="xs"
          label={<Trans>Dates</Trans>}
          error={datesInputProps.error}
        >
          <Flex mb="xs">
            <DateInput
              leftSection={<IconCalendar size={16} />}
              error={datesInputProps.error != null}
              value={startDate}
              valueFormat="YYYY-MM-DD"
              onChange={(value) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [_, endDate] = datesInputProps.value;
                datesInputProps.onChange([value, endDate]);
              }}
              style={{ flexGrow: 1 }}
            />
            <DateInput
              leftSection={<IconCalendar size={16} />}
              error={datesInputProps.error != null}
              value={endDate}
              valueFormat="YYYY-MM-DD"
              onChange={(value) => {
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const [startDate, _] = datesInputProps.value;
                datesInputProps.onChange([startDate, value]);
              }}
              style={{ flexGrow: 1 }}
            />
          </Flex>
          <Center>
            <DatePicker
              {...datesInputProps}
              defaultDate={startDate ?? undefined}
              type="range"
              numberOfColumns={2}
              columnsToScroll={1}
              allowSingleDateInRange
              monthLabelFormat={(date) =>
                i18n.date(parseDate(date, "yyyy-MM-dd", refDate), {
                  month: "long",
                  year: "numeric",
                })
              }
              weekdayFormat={(date) =>
                i18n.date(parseDate(date, "yyyy-MM-dd", refDate), {
                  weekday: "narrow",
                })
              }
            />
          </Center>
        </Input.Wrapper>
        <PlacePicker
          size="sm"
          mb="xs"
          error={locationInputProps.error}
          clearable
          leftSection={<IconMapPin size={16} />}
          value={
            form.values.location != null
              ? {
                  country: form.values.country,
                  latLng: form.values.latLng,
                  location: form.values.location,
                }
              : null
          }
          label={<Trans>Location</Trans>}
          onChange={(place) => {
            form.setValues((prev) => ({
              ...prev,
              location: place != null ? place.location : "",
              country: place != null ? place.country : undefined,
              latLng: place != null ? place.latLng : undefined,
            }));
          }}
        />
      </form>
      <Flex style={{ flexGrow: 1, flexDirection: "column" }}>
        <TextInput
          readOnly
          value={`${conId}.json`}
          size="xs"
          leftSection={<IconFile size={14} />}
        />
        <Box style={{ position: "relative", flexGrow: 1 }}>
          <Code
            h="100%"
            block
            style={{ wordWrap: "break-word", whiteSpace: "pre-wrap" }}
          >
            {raw}
          </Code>
          <Tooltip
            position="left"
            label={
              clipboard.copied ? (
                <Trans>Copied!</Trans>
              ) : (
                <Trans>Copy to clipboard</Trans>
              )
            }
          >
            <ActionIcon
              pos="absolute"
              right={6}
              top={6}
              variant="default"
              onClick={() => {
                clipboard.copy(raw);
              }}
            >
              {clipboard.copied ? (
                <IconCopyCheck size={16} />
              ) : (
                <IconCopy size={16} />
              )}
            </ActionIcon>
          </Tooltip>
        </Box>
      </Flex>
    </Flex>
  );
}

const theme = createTheme({});

const WEEK_INFO = (() => {
  const locale = new Intl.Locale(navigator.language);
  return (
    (
      locale as {
        getWeekInfo?(): { firstDay: number; weekend: number[] };
      }
    ).getWeekInfo?.() ?? { firstDay: 7, weekend: [6, 7] }
  );
})();

export default function App() {
  return (
    <I18nProvider i18n={i18n}>
      <MantineProvider theme={theme}>
        <DatesProvider
          settings={{
            firstDayOfWeek: (WEEK_INFO.firstDay % 7) as DayOfWeek,
            weekendDays: WEEK_INFO.weekend.map((d) => (d % 7) as DayOfWeek),
          }}
        >
          <Suspense
            fallback={
              <Center>
                <Loader />
              </Center>
            }
          >
            <Editor />
          </Suspense>
        </DatesProvider>
      </MantineProvider>
    </I18nProvider>
  );
}
