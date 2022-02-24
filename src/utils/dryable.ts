import { FEATURE_FLAGS } from "../configurations/featureFlags";

export function dryable(featureFlag: string, returnValue: any): any {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      if (FEATURE_FLAGS[featureFlag]) {
        descriptor.value = function () {
            return returnValue;
        }
      }
      return descriptor;
  }
}