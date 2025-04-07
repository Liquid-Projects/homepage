import cache from "memory-cache";

import { formatApiCall } from "utils/proxy/api-helpers";
import { httpProxy } from "utils/proxy/http";
import getServiceWidget from "utils/config/service-helpers";
import createLogger from "utils/logger";

const proxyName = "redfishProxyHandler";
const sessionTokenCacheKey = `${proxyName}__sessionToken`;
const logger = createLogger(proxyName);

// Manually create URL-encoded data
const createUrlEncodedData = (data) => {
    return Object.keys(data)
    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
    .join('&');
};

async function login_redfish(widget, service) {
  logger.debug("redfish is rejecting the request, logging in.");

  const loginUrl = new URL(`${widget.url}/redfish/v1/SessionService/Sessions/`).toString();
  const loginBody = JSON.stringify({ UserName: widget.username,  Password: widget.password});
  const loginParams = {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: loginBody,
  };

  const [status, contentType, data,responseHeaders] = await httpProxy(loginUrl, loginParams);

  try {
    const token = responseHeaders["x-auth-token"];
    cache.put(`${sessionTokenCacheKey}.${service}`, token, 30);
    return { token };
  } catch (e) {
    logger.error("Unable to login to redfish API: %s", e);
  }
  return { token: false };
}

async function api_redfish(widget, endpoint, service) {
  const key = `${sessionTokenCacheKey}.${service}`;
  const url = new URL(formatApiCall("{url}/redfish/v1/{endpoint}", { endpoint, ...widget }));
  //logger.info(url);
  //logger.info(cache.get(key));
  const headers = {
    "Content-Type": "application/json",
    "X-Auth-Token": `${cache.get(key)}`,
  };
  const params = { method: "GET", headers };

  let [status, contentType, data, responseHeaders] = await httpProxy(url, params);

  if (status === 401 || status === 403) {
    logger.debug("redfish API rejected the request, attempting to obtain new access token");
    const { token } = await login_redfish(widget, service);
    headers.Authorization = `${token}`;

    // retry request with new token
    [status, contentType, data, responseHeaders] = await httpProxy(url, params);

    if (status !== 200) {
      logger.error("HTTP %d logging in to redfish, data: %s", status, data);
      return { status, contentType, data: null, responseHeaders };
    }
  }

  if (status !== 200) {
    logger.error("HTTP %d getting data from redfish, data: %s", status, data);
    return { status, contentType, data: null, responseHeaders };
  }

  return { status, contentType, data: JSON.parse(data.toString()), responseHeaders };
}

export default async function redfishProxyHandler(req, res) {
  const { group, service, index } = req.query;
  if (!group || !service) {
  logger.debug("Invalid or missing service '%s' or group '%s'", service, group);
  return res.status(400).json({ error: "Invalid proxy service type" });
  }

  const widget = await getServiceWidget(group, service, index);
  if (!widget) {
  logger.debug("Invalid or missing widget for service '%s' in group '%s'", service, group);
  return res.status(400).json({ error: "Invalid proxy service type" });
  }


  if (!cache.get(`${sessionTokenCacheKey}.${service}`)) {
      await login_redfish(widget, service);
  }

  // Get stats for the main blocks
  const { data } = await api_redfish(widget, "Systems/Self", service);

  return res.status(200).send({
  PowerStatus: data["PowerState"]
  });
}