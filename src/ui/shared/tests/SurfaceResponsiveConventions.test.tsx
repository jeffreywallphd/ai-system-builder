import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SurfaceResponsiveActionMenuContainer,
  SurfaceResponsiveFormLayout,
  SurfaceResponsiveStatusCardGroup,
  SurfaceResponsiveTableContainer,
} from "../components/shell";
import { createSurfaceResponsiveProfile } from "../responsive";

describe("SurfaceResponsiveConventions", () => {
  it("renders table/form/status wrappers with responsive layout metadata", () => {
    const mobileProfile = createSurfaceResponsiveProfile({ viewportWidthPx: 430 });

    const html = renderToStaticMarkup(
      <div>
        <SurfaceResponsiveTableContainer responsiveProfile={mobileProfile}>
          <table className="ui-responsive-table__table">
            <tbody>
              <tr>
                <td data-label="Status">Healthy</td>
              </tr>
            </tbody>
          </table>
        </SurfaceResponsiveTableContainer>
        <SurfaceResponsiveFormLayout responsiveProfile={mobileProfile}>
          <div className="ui-responsive-form__grid">form fields</div>
        </SurfaceResponsiveFormLayout>
        <SurfaceResponsiveStatusCardGroup responsiveProfile={mobileProfile}>
          <div className="ui-responsive-status-cards__grid">status cards</div>
        </SurfaceResponsiveStatusCardGroup>
      </div>,
    );

    expect(html).toContain("ui-responsive-table");
    expect(html).toContain("data-layout=\"cards\"");
    expect(html).toContain("ui-responsive-form");
    expect(html).toContain("ui-responsive-status-cards");
  });

  it("renders action menu container with touch-target metadata", () => {
    const tabletProfile = createSurfaceResponsiveProfile({ viewportWidthPx: 900 });
    const html = renderToStaticMarkup(
      <SurfaceResponsiveActionMenuContainer responsiveProfile={tabletProfile}>
        <button type="button" className="ui-button">Action</button>
      </SurfaceResponsiveActionMenuContainer>,
    );

    expect(html).toContain("ui-responsive-action-menu");
    expect(html).toContain("data-layout=\"menu\"");
    expect(html).toContain("data-touch-target=\"44\"");
  });
});

