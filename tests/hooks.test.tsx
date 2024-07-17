import assert from "assert";

import {useCallback, useEffect, useRef, useState} from "react";
import {act, render, renderHook, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import {cleanInput, displayFormat, getFormattedNumber, getRawValue, parsePhoneNumber, useMask, usePhone} from "../src";

const usePhoneTester = ({
                            country = "us",
                            initialValue = "",
                            onlyCountries = [],
                            excludeCountries = [],
                            preferredCountries = [],
                            disableParentheses = false,
                        }) => {
    const initiatedRef = useRef<boolean>(false);
    const [query, setQuery] = useState<string>("");
    const [countryCode, setCountryCode] = useState<string>(country);

    const {
        value,
        pattern,
        metadata,
        setValue,
        countriesList,
    } = usePhone({
        query,
        country,
        countryCode,
        initialValue,
        onlyCountries,
        excludeCountries,
        preferredCountries,
        disableParentheses,
    });

    const update = useCallback((value: string) => {
        const formattedNumber = getFormattedNumber(value, pattern);
        const phoneMetadata = parsePhoneNumber(formattedNumber, countriesList);
        setCountryCode(phoneMetadata.isoCode as any);
        setValue(formattedNumber);
    }, [countriesList, pattern, setValue]);

    const backspace = useCallback(() => {
        const formattedNumber = displayFormat(getRawValue(value).slice(0, -1));
        const phoneMetadata = parsePhoneNumber(formattedNumber, countriesList);
        setCountryCode(phoneMetadata.isoCode as any);
        setValue(formattedNumber);
    }, [value, countriesList, setValue]);

    const search = useCallback(setQuery, []);

    const select = useCallback((isoCode: string) => {
        const pattern = (countriesList.find(({ iso }) => iso === isoCode) as any).mask;
        const mask = disableParentheses ? pattern.replace(/[()]/g, "") : pattern;
        setValue(displayFormat(cleanInput(mask, mask).join("")));
        setCountryCode(isoCode);
    }, [setValue, countriesList]);

    useEffect(() => {
        if (initiatedRef.current) return;
        initiatedRef.current = true;
        let initialValue = getRawValue(value);
        if (!initialValue.startsWith(metadata?.code as string)) {
            initialValue = metadata?.code as string;
        }
        const formattedNumber = getFormattedNumber(initialValue, pattern);
        const phoneMetadata = parsePhoneNumber(formattedNumber, countriesList);
        setCountryCode(phoneMetadata.isoCode as any);
        setValue(formattedNumber);
    }, [countriesList, pattern, metadata, setValue, value])

    return {update, search, select, value, metadata, backspace, countriesList};
}

const UseMaskTester = ({pattern = "", ...props}: any) => {
    return <input data-testid="input" {...useMask(pattern)} {...props}/>;
}

describe("Verifying the functionality of hooks", () => {
    it("Check the usePhone hook initiation and updates", () => {
        const {result} = renderHook(usePhoneTester, {
            initialProps: {
                initialValue: "37411111111",
            }
        });
        expect(result.current.value).toBe("+374 (11) 111 111");
        expect((result.current.metadata as any).iso).toBe("am");

        act(() => result.current.update("1"));
        act(() => result.current.update("1111"));

        expect(result.current.value).toBe("+1 (111)");
        expect((result.current.metadata as any).iso).toBe("us");
    })

    it("Check usePhone for country code update", () => {
        const {result} = renderHook(usePhoneTester, {
            initialProps: {
                initialValue: "17021234567",
            }
        });
        expect(result.current.value).toBe("+1 (702) 123 4567");
        expect((result.current.metadata as any).iso).toBe("us");

        act(() => result.current.select("ua"));

        expect(result.current.value).toBe("+380");
        expect((result.current.metadata as any).iso).toBe("ua");
    })

    it("Check usePhone for searching a country", () => {
        const {result} = renderHook(usePhoneTester, {
            initialProps: {}
        });

        act(() => result.current.search("Armenia"));

        expect(result.current.countriesList).toHaveLength(1);

        act(() => result.current.select(result.current.countriesList[0].iso));

        expect((result.current.metadata as any).iso).toBe("am");
    })

    it("Check usePhone for advanced country filtering", () => {
        const {result} = renderHook(usePhoneTester, {
            initialProps: {
                onlyCountries: ["ae", "gb", "us"] as any,
                excludeCountries: ["1907", "1205", "1251"] as any,
            }
        });

        expect(result.current.countriesList.map(c => c.code).includes("1"));
        expect(result.current.countriesList.map(c => c.code).includes("44"));
        expect(result.current.countriesList.map(c => c.code).includes("971"));

        expect(!result.current.countriesList.map(c => c.code).includes("1907"));
        expect(!result.current.countriesList.map(c => c.code).includes("1205"));
        expect(!result.current.countriesList.map(c => c.code).includes("1251"));
    })

    it("Check usePhone without parentheses", () => {
        const {result} = renderHook(usePhoneTester, {
            initialProps: {
                country: "au",
                disableParentheses: true,
            }
        });

        act(() => result.current.update("6104111"));

        expect(result.current.value).toBe("+61 0 4111");
        expect((result.current.metadata as any).iso).toBe("au");

        act(() => result.current.select("ms"));

        expect(result.current.value).toBe("+1 664");
    })

    it("Check usePhone for country detection", () => {
        const {result} = renderHook(usePhoneTester, {
            initialProps: {}
        });

        act(() => result.current.update("1"));

        expect((result.current.metadata as any).iso).toBe("us");

        act(() => result.current.update("1204"));

        expect((result.current.metadata as any).iso).toBe("ca");

        act(() => result.current.backspace());

        expect((result.current.metadata as any).iso).toBe("us");
    })

    it("Check useMask for basic use case", async () => {
        render(<UseMaskTester
            pattern="+... (..) ... ....."
            onChange={(e: any) => {
                const isValid = "+380 (11) 222 34567".startsWith(e.target.value);
                assert(isValid || "+380 (1)" === e.target.value);
            }}
        />);

        await userEvent.type(screen.getByTestId("input"), "3801122234567");
    })
})
